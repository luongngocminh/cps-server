/* eslint-disable @typescript-eslint/no-empty-function */
import { IBytesPacket, IPacketStatus, IPacketType } from '@/interfaces/IBytesPacket';
import { MqttClient, Packet } from 'mqtt';
import { Service, Inject } from 'typedi';
import { Logger } from 'winston';
import crc32 from 'crc-32';
import { TOPICS, uint8arr2int } from '@/utils';
import { EventDispatcher, EventDispatcherInterface } from '@/decorators/eventDispatcher';
import socketEvents from '@/socketio/events';
import events from '@/subscribers/events';
import NodeRegistryService from './node-registry';
import { Point, WriteApi } from '@influxdata/influxdb-client';
import { Server } from 'socket.io';

@Service()
export default class MQTTService {
  constructor(
    @Inject('logger') private logger: Logger,
    @Inject('mqttClient') private mqtt: MqttClient,
    @Inject('nodeModel') private nodeModel: Models.NodeModel,
    @Inject('influxWrite') private influxWrite: () => WriteApi,
    @Inject('io') private io: Server,
    private nodeRegistry: NodeRegistryService,
    @EventDispatcher() private eventDispatcher: EventDispatcherInterface,
  ) {}

  processIncomingMessage(topic: TOPICS, message: Buffer, packet: Packet): void {
    console.log(topic, message, packet);
    if (!Object.values(TOPICS).includes(topic)) {
      this.logger.warn('Invalid Topic received: %s', topic);
      return;
    }

    const bytes = new Uint8Array(message);
    if (topic === TOPICS.SVR_IN) {
      if (!this.validateMessage(bytes)) {
        this.logger.error('Invalid checksum message received');
        return;
      }
      const payload = this.unpackMessage(bytes);
      console.log(payload);
      const handler = {
        [IPacketType.CONN]: this.processConnectMsg,
        [IPacketType.DISCONN]: this.processDisconnectMsg,
        // [IPacketType.RES]: this.processResponseMsg,
        [IPacketType.INFO]: this.processInfoMsg,
        [IPacketType.DATA]: this.processDataMsg,
      };
      if (!(payload.type in handler)) {
        this.logger.error('Invalid message type: %i', payload.type);
      } else {
        handler[payload.type].bind(this)(payload);
      }
    }
  }

  unpackMessage(bytes: Uint8Array): IBytesPacket {
    const checksum = bytes.slice(-4);
    const payload = bytes.slice(0, -4);

    const version = payload[0];
    const node = {
      id: payload[1],
      type: payload[2],
    };
    const type = payload[3] as IPacketType;
    const status = payload[4] as IPacketStatus;
    const ts = uint8arr2int(payload.slice(5, 9));
    const data = payload.slice(9);
    //
    return {
      id: checksum.toString(),
      version,
      node,
      type,
      status,
      ts,
      data,
    };
  }

  validateMessage(bytes: Uint8Array): boolean {
    const checksum = uint8arr2int(bytes.slice(-4));
    console.log('checklsum', checksum);
    const payload = bytes.slice(0, -4);
    console.log(payload);

    const crc = crc32.buf(payload);
    console.log('crc', crc);

    return checksum === crc;
  }

  async processConnectMsg(payload: IBytesPacket) {
    this.logger.info('Connected to %s', payload.node.id);

    // •	Battery: 1 Byte 0-100
    // •	RTC: 4 Bytes Unix epoch
    // •	Temperature: 1 Byte 0-255
    const data = payload.data;
    const battery = data[0];
    const rtc = uint8arr2int(data.slice(1, -1));
    const temperature = data[data.length - 1];
    this.logger.info('Battery: %s', battery);
    this.logger.info('RTC: %s', rtc);
    this.logger.info('Temperature: %s', temperature);
    // Push this node using current mongoose node model
    const options = { upsert: true, new: true, setDefaultsOnInsert: true };

    const nodeObject = await this.nodeModel
      .findOneAndUpdate(
        { nid: payload.node.id, type: payload.node.type },
        { latestConnectedAt: new Date(), battery, rtc, temperature },
        options,
      )
      .lean()
      .exec();

    this.nodeRegistry.add(nodeObject);
    console.log(this.nodeRegistry.getAll());
    this.eventDispatcher.dispatch(events.node.onConnect, nodeObject);
  }
  async processDisconnectMsg(payload: IBytesPacket) {
    this.logger.info('Disconnected to %s', payload.node.id);
    const data = payload.data;
    const battery = data[0];
    const rtc = uint8arr2int(data.slice(1, -1));
    const temperature = data[data.length - 1];
    this.logger.info('Battery: %s', battery);
    this.logger.info('RTC: %s', rtc);
    this.logger.info('Temperature: %s', temperature);
    // Push this node using current mongoose node model
    const options = { upsert: true, new: true, setDefaultsOnInsert: true };

    const nodeObject = await this.nodeModel
      .findOneAndUpdate(
        { nid: payload.node.id, type: payload.node.type },
        { latestConnectedAt: new Date(), battery, rtc, temperature, status: 1 },
        options,
      )
      .exec();

    this.nodeRegistry.delete(nodeObject.nid, nodeObject.type);
    this.eventDispatcher.dispatch(events.node.onDisconnect, nodeObject);
  }

  async processInfoMsg(payload: IBytesPacket) {
    this.logger.info('Info received from %s', payload.node.id);
    const writeApi = this.influxWrite();

    // •	Battery: 1 Byte 0-100
    // •	RTC: 4 Bytes Unix epoch
    // •	Temperature: 1 Byte 0-255
    const data = payload.data;
    const battery = data[0];
    const rtc = uint8arr2int(data.slice(1, -1));
    const temperature = data[data.length - 1];
    this.logger.info('Battery: %s', battery);
    this.logger.info('RTC: %s', rtc);
    this.logger.info('Temperature: %s', temperature);
    const points = [];
    const ts = new Date();
    points.push(
      new Point('battery')
        .tag('nodeid', '' + payload.node.id)
        .tag('ntype', 'sensor')
        .floatField('value', battery)
        .timestamp(ts),
    );
    points.push(
      new Point('temperature')
        .tag('nodeid', '' + payload.node.id)
        .tag('ntype', 'sensor')
        .floatField('value', temperature)
        .timestamp(ts),
    );
    points.push(
      new Point('rtc')
        .tag('nodeid', '' + payload.node.id)
        .tag('ntype', 'sensor')
        .intField('value', rtc)
        .timestamp(ts),
    );
    writeApi.writePoints(points);

    this.io.emit(socketEvents.node.info, [
      { _measurement: 'battery', _value: battery, nodeid: payload.node.id, ntype: payload.node.type, _time: ts },
      {
        _measurement: 'temperature',
        _value: temperature,
        nodeid: payload.node.id,
        ntype: payload.node.type,
        _time: ts,
      },
      { _measurement: 'rtc', _value: rtc, nodeid: payload.node.id, ntype: payload.node.type, _time: ts },
    ]);
    // Push this node using current mongoose node model
    const options = { upsert: true, new: true, setDefaultsOnInsert: true };

    const nodeObject = await this.nodeModel
      .findOneAndUpdate(
        { nid: payload.node.id, type: payload.node.type },
        { latestConnectedAt: new Date(), battery, rtc, temperature },
        options,
      )
      .lean()
      .exec();

    this.io;
    this.nodeRegistry.update(nodeObject);
    try {
      await writeApi.close();
    } catch (err) {
      console.log('Error when closing Write API');
      console.log(err);
    }
  }

  // processResponseMsg(payload: IBytesPacket) {}
  async processDataMsg(payload: IBytesPacket) {
    this.logger.info('DATA received from %s', payload.node.id);
    const writeApi = this.influxWrite();
    const data = payload.data;
    const points = [];
    if (payload.node.type === 0) {
      // sensor
      for (let i = 0; i < data.length / 10; i++) {
        const subdata = data.slice(i * 10, i * 10 + 10);
        const v_off = uint8arr2int(subdata.slice(0, 2));
        const v_shift = uint8arr2int(subdata.slice(2, 4));
        const i_curr = uint8arr2int(subdata.slice(4, 6));
        const ts = new Date(uint8arr2int(subdata.slice(6, 10)));

        points.push(
          new Point('v_off')
            .tag('nodeid', '' + payload.node.id)
            .floatField('value', v_off)
            .timestamp(ts),
        );
        points.push(
          new Point('v_shift')
            .tag('nodeid', '' + payload.node.id)
            .floatField('value', v_shift)
            .timestamp(ts),
        );
        points.push(
          new Point('i_curr')
            .tag('nodeid', '' + payload.node.id)
            .floatField('value', i_curr)
            .timestamp(ts),
        );
      }
    } else {
      // station
      const st_status = data[0];
      const motor_status = data[1];
      const contactor_status = data[2];
      points.push(
        new Point('st_status')
          .tag('nodeid', '' + payload.node.id)
          .floatField('value', st_status)
          .timestamp(payload.ts),
      );
      points.push(
        new Point('motor_status')
          .tag('nodeid', '' + payload.node.id)
          .floatField('value', motor_status)
          .timestamp(payload.ts),
      );
      points.push(
        new Point('contactor_status')
          .tag('nodeid', '' + payload.node.id)
          .floatField('value', contactor_status)
          .timestamp(payload.ts),
      );
    }
    writeApi.writePoints(points);
    await writeApi.close();
  }
}

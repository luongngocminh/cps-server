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
import { INode } from '@/models/node';
import { addMinutes, addSeconds } from 'date-fns';

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
      const handler = {
        [IPacketType.CONN]: this.processConnectMsg,
        [IPacketType.DISCONN]: this.processDisconnectMsg,
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

  turnOffNode(node: INode) {
    const type = IPacketType.CMD;
    const cmd = 0x03;
    const cmdbuf = Buffer.alloc(1);
    cmdbuf.writeInt8(cmd);
    const payload = Buffer.concat([cmdbuf]);

    const packet = this.packMessage(node, type, payload);
    this.mqtt.publish(TOPICS.SVR_OUT, packet, () => {
      console.log('published');
    });
  }

  manualMotorControl(node: INode, value: number) {
    const type = IPacketType.CMD;
    const cmd = 0x02;
    const cmdbuf = Buffer.alloc(1);
    cmdbuf.writeInt8(cmd);
    const valuebuf = Buffer.alloc(2);
    valuebuf.writeInt16LE(value);
    const payload = Buffer.concat([cmdbuf, valuebuf]);

    const packet = this.packMessage(node, type, payload);
    this.mqtt.publish(TOPICS.SVR_OUT, packet, () => {
      console.log('published');
    });
  }

  triggerCalibration(node?: INode) {
    const type = IPacketType.CMD;
    const cmd = 0x00;
    const cmdbuf = Buffer.alloc(1);
    cmdbuf.writeInt8(cmd);
    const ts = Math.floor(addMinutes(new Date(), 10).getTime() / 1000);
    const tsbuf = Buffer.alloc(4);
    tsbuf.writeInt32LE(ts, 0);
    const payload = Buffer.concat([cmdbuf, tsbuf]);

    if (!node) {
      node = {
        nid: 0xff, //broadcast
        type: 0x00,
      };
    }
    const packet = this.packMessage(node, type, payload);
    this.mqtt.publish(TOPICS.SVR_OUT, packet, () => {
      console.log('published');
    });
  }

  packMessage(node: INode, type: IPacketType, data: Buffer) {
    const version = 0;
    // a Sensor Node with ID 0
    const status = 0;
    const ts = Math.floor(new Date().getTime() / 1000);
    const header = Buffer.from([version, node.nid, node.type, type, status]);
    const tsbuf = Buffer.alloc(4);
    tsbuf.writeInt32LE(ts, 0);

    const bytes = Buffer.concat([header, tsbuf, data]);
    const crc = crc32.buf(bytes);
    const crcbuf = Buffer.alloc(4);
    crcbuf.writeInt32LE(crc, 0);
    const packet = Buffer.concat([bytes, crcbuf]);

    console.log(packet);
    console.log(packet.length);

    return packet;
  }

  unpackMessage(bytes: Uint8Array): IBytesPacket {
    const checksum = bytes.slice(-4);
    const payload = bytes.slice(0, -4);
    const nodeMeta = payload[2];
    let nodeType = 0; // sensor
    let parent = null;
    if (nodeMeta === 0xff) {
      nodeType = 1;
    } else {
      parent = nodeMeta;
    }

    const version = payload[0];
    const node = {
      id: payload[1],
      type: nodeType,
      parent,
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
    const payload = bytes.slice(0, -4);
    const crc = crc32.buf(payload);
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
        { nid: payload.node.id, type: payload.node.type, parent: payload.node.parent },
        { latestConnectedAt: new Date(), battery, rtc, temperature },
        options,
      )
      .lean()
      .exec();

    this.nodeRegistry.add(nodeObject);
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
    const ntype = payload.node.type ? 'station' : 'sensor';
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
    if (payload.node.type === 0) {
      points.push(
        new Point('battery')
          .tag('nodeid', '' + payload.node.id)
          .tag('ntype', ntype)
          .floatField('value', battery)
          .timestamp(ts),
      );
    }
    points.push(
      new Point('temperature')
        .tag('nodeid', '' + payload.node.id)
        .tag('ntype', ntype)
        .floatField('value', temperature)
        .timestamp(ts),
    );
    points.push(
      new Point('rtc')
        .tag('nodeid', '' + payload.node.id)
        .tag('ntype', ntype)
        .intField('value', rtc)
        .timestamp(ts),
    );
    console.log(points);
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
    const nid = '' + payload.node.id;
    const ts = new Date(payload.ts * 1000);
    if (payload.node.type === 0) {
      // sensor
      const v_on = uint8arr2int(data.slice(0, 2), true);
      const v_off = uint8arr2int(data.slice(2, 4), true);
      const v_na = uint8arr2int(data.slice(4, 6), true);

      points.push(new Point('v_off').tag('nodeid', nid).tag('ntype', 'sensor').intField('value', v_off).timestamp(ts));
      points.push(new Point('v_on').tag('nodeid', nid).tag('ntype', 'sensor').intField('value', v_on).timestamp(ts));
      points.push(new Point('v_na').tag('nodeid', nid).tag('ntype', 'sensor').intField('value', v_na).timestamp(ts));
    } else {
      // station
      const v_shift = uint8arr2int(data.slice(0, 2), true);
      const i_p = uint8arr2int(data.slice(2, 4), true);
      points.push(new Point('i_p').tag('nodeid', nid).tag('ntype', 'station').intField('value', i_p).timestamp(ts));
      points.push(
        new Point('v_shift').tag('nodeid', nid).tag('ntype', 'station').intField('value', v_shift).timestamp(ts),
      );
    }
    console.log(points);
    writeApi.writePoints(points);
    try {
      await writeApi.close();
    } catch (err) {
      console.log('Error when closing Write API');
      console.log(err);
    }
  }

  async sendTurnOffCommand(node: INode) {
    const command = 0x03; // turn off
    const payload = Buffer.from([command]);
    const packet = this.packMessage(node, IPacketType.CMD, payload);
    this.mqtt.publish(TOPICS.SVR_OUT, packet, () => {
      this.logger.info('Turn off command sent to node %s', node.nid);
    });
  }

  async broadcastAbortCommand() {
    const node = {
      nid: 0xff, // broadcast,
      type: 0,
    };
    const command = 0xff; // abort
    const payload = Buffer.from([command]);
    const packet = this.packMessage(node, IPacketType.CMD, payload);
    this.mqtt.publish(TOPICS.SVR_OUT, packet, () => {
      this.logger.info('Abort command sent to node %s', node.nid);
    });
  }

  async broadcastTriggerCommand() {
    const node = {
      nid: 0xff, // broadcast,
      type: 0,
    };
    const command = 0x00; // trigger
    const nextTenSecond = addSeconds(new Date(), 50);
    const unixEpoch = Math.floor(nextTenSecond.getTime() / 1000);
    // convert nextTenSecond to 4 bytes using Buffer
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32LE(unixEpoch);
    const payload = Buffer.concat([Buffer.from([command]), buffer]);

    const packet = this.packMessage(node, IPacketType.CMD, payload);
    this.mqtt.publish(TOPICS.SVR_OUT, packet, () => {
      this.logger.info('Trigger command sent to all nodes');
      this.nodeRegistry.getAll().forEach(node => {
        this.nodeRegistry.update({ ...node, nextTriggerAt: nextTenSecond });
      });
    });
    //
  }
}

/* eslint-disable @typescript-eslint/no-empty-function */
import { IBytesPacket, IPacketStatus, IPacketType } from '@/interfaces/IBytesPacket';
import { MqttClient, Packet } from 'mqtt';
import { Service, Inject } from 'typedi';
import { Logger } from 'winston';
import crc32 from 'crc-32';
import { TOPICS, uint8arr2int } from '@/utils';
import { EventDispatcher, EventDispatcherInterface } from '@/decorators/eventDispatcher';
import events from '@/subscribers/events';
import NodeRegistryService from './node-registry';

@Service()
export default class MQTTService {
  constructor(
    @Inject('logger') private logger: Logger,
    @Inject('mqttClient') private mqtt: MqttClient,
    @Inject('nodeModel') private nodeModel: Models.NodeModel,
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
        [IPacketType.RES]: this.processResponseMsg,
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
  processInfoMsg(payload: IBytesPacket) {}
  processResponseMsg(payload: IBytesPacket) {}
  processDataMsg(payload: IBytesPacket) {}
}

/* eslint-disable @typescript-eslint/no-empty-function */
import { IBytesPacket, IPacketStatus, IPacketType } from '@/interfaces/IBytesPacket';
import { MqttClient, Packet } from 'mqtt';
import { Service, Inject } from 'typedi';
import { Logger } from 'winston';
import crc32 from 'crc-32';
import { uint8arr2int } from '@/utils';

enum TOPICS {
  SVR_IN = 'svr/in',
  SVR_OUT = 'svr/out',
}

@Service()
export default class MQTTService {
  constructor(@Inject('logger') private logger: Logger, @Inject('mqttClient') private mqtt: MqttClient) {}

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
        handler[payload.type](payload);
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
    const payload = bytes.slice(0, -4);

    const crc = crc32.buf(payload);

    return checksum === crc;
  }

  processConnectMsg(payload: IBytesPacket) {}
  processDisconnectMsg(payload: IBytesPacket) {}
  processInfoMsg(payload: IBytesPacket) {}
  processResponseMsg(payload: IBytesPacket) {}
  processDataMsg(payload: IBytesPacket) {}
}

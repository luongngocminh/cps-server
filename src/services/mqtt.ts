import { Service, Inject } from 'typedi';

@Service()
export default class MQTTService {
  constructor(@Inject('logger') private logger) {}

  processIncomingMessage(topic: string, message: any, packet: any) {
    console.log(topic, message, packet);
  }
}

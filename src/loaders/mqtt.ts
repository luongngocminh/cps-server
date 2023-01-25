import MQTTService from '@/services/mqtt';
import { TOPICS } from '@/utils';
import Container from 'typedi';
import Logger from './logger';

export default ({ client }) => {
  // Logger.debug(process.env.BROKER_URL, 'client', clientId)

  client.on('connect', function (connack) {
    Logger.info('MQTT Client connected: %o', connack);
    client.subscribe(TOPICS.SVR_IN, function (err) {
      if (!err) {
        Logger.info('Subscribed to topic "svr/in"');
      }
    });
  });

  client.on('error', function (err: any) {
    Logger.debug('MQTT Error: %o', err);

    if (err?.code === 'ENOTFOUND') {
      Logger.debug('MQTT Network error, make sure you have an active internet connection');
    }
  });

  client.on('close', function () {
    Logger.debug('MQTT Connection closed by client');
  });

  client.on('reconnect', function () {
    Logger.debug('MQTT Client trying a reconnection');
  });

  client.on('offline', function () {
    Logger.debug('MQTT Client is currently offline');
  });

  client.on('message', (topic, message, packet) => {
    console.log(topic, message);
    Container.get(MQTTService).processIncomingMessage(topic, message, packet);
  });
};

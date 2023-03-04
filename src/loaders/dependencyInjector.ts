import { Container } from 'typedi';
import formData from 'form-data';
import Mailgun from 'mailgun.js';
import LoggerInstance from './logger';
import agendaFactory from './agenda';
import influxFactory from './influx';
import mqtt from 'mqtt';
import config from '@/config';
import { SystemStore } from './store';
import { Server as HttpServerInterface } from 'http';
import { Server as SocketServer } from 'socket.io';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default ({
  mongoConnection,
  models,
  httpServer,
}: {
  mongoConnection;
  models: { name: string; model: any }[];
  httpServer: HttpServerInterface;
}) => {
  try {
    models.forEach(m => {
      Container.set(m.name, m.model);
    });

    const agendaInstance = agendaFactory({ mongoConnection });
    const mqttClient = mqtt.connect(config.mqttURL, {
      clientId: 'MASTER_SVR',
      clean: false,
      username: 'admin',
      password: 'password',
    });
    const mgInstance = new Mailgun(formData);
    const influxQueryFactory = influxFactory.query;
    const influxWriteFactory = influxFactory.write;
    const socketServer = new SocketServer(httpServer, {
      cors: {
        origin: 'http://localhost:4200',
        methods: ['GET', 'POST'],
      },
    });

    Container.set('agendaInstance', agendaInstance);
    Container.set('logger', LoggerInstance);
    Container.set('emailClient', mgInstance.client({ key: config.emails.apiKey, username: config.emails.apiUsername }));
    Container.set('emailDomain', config.emails.domain);
    Container.set('influxQuery', influxQueryFactory);
    Container.set('influxWrite', influxWriteFactory);
    Container.set('mqttClient', mqttClient);
    Container.set('systemStore', SystemStore);
    Container.set('io', socketServer);

    LoggerInstance.info('✌️ Agenda injected into container');

    return { agenda: agendaInstance, mqtt: mqttClient, io: socketServer };
  } catch (e) {
    LoggerInstance.error('🔥 Error on dependency injector loader: %o', e);
    throw e;
  }
};

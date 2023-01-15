import { Container } from 'typedi';
import formData from 'form-data';
import Mailgun from 'mailgun.js';
import LoggerInstance from './logger';
import agendaFactory from './agenda';
import influxFactory from './influx';
import mqtt from 'mqtt';
import config from '@/config';

export default ({ mongoConnection, models }: { mongoConnection; models: { name: string; model: any }[] }) => {
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
    const influxQueryInstance = influxFactory.query();
    const influxWriteInstance = influxFactory.write();

    Container.set('agendaInstance', agendaInstance);
    Container.set('logger', LoggerInstance);
    Container.set('emailClient', mgInstance.client({ key: config.emails.apiKey, username: config.emails.apiUsername }));
    Container.set('emailDomain', config.emails.domain);
    Container.set('influxQuery', influxQueryInstance);
    Container.set('influxWrite', influxWriteInstance);
    Container.set('mqttClient', mqttClient);

    LoggerInstance.info('✌️ Agenda injected into container');

    return { agenda: agendaInstance, mqtt: mqttClient };
  } catch (e) {
    LoggerInstance.error('🔥 Error on dependency injector loader: %o', e);
    throw e;
  }
};

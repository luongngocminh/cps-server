import InfluxService from '@/services/influx';
import MQTTService from '@/services/mqtt';
import NodeRegistryService from '@/services/node-registry';
import { celebrate, Joi, Segments } from 'celebrate';
import { Router, Request, Response, NextFunction } from 'express';
import { Container } from 'typedi';
import { Logger } from 'winston';
import middlewares from '../middlewares';
const route = Router();

export default (app: Router) => {
  app.use('/node', route);

  route.get(
    '/',
    middlewares.isAuth,
    middlewares.attachCurrentUser,
    (req: Request, res: Response, next: NextFunction) => {
      const logger: Logger = Container.get('logger');
      const nodeRegistry = Container.get(NodeRegistryService);
      try {
        return res.json(nodeRegistry.getAll());
      } catch (e) {
        logger.error('🔥 error: %o', e);
        return next(e);
      }
    },
  );

  route.get(
    '/q',
    celebrate({
      [Segments.QUERY]: Joi.object({
        start: Joi.string().required(),
        stop: Joi.string().required(),
        measurements: Joi.string().required(),
        nids: Joi.string(),
        ntype: Joi.string(),
        every: Joi.string(),
        fn: Joi.string(),
      }),
    }),
    middlewares.isAuth,
    middlewares.attachCurrentUser,
    async (req: Request, res: Response, next: NextFunction) => {
      const logger: Logger = Container.get('logger');
      try {
        const influxService = Container.get(InfluxService);
        const q = {
          start: req.query.start as string,
          stop: req.query.stop as string,
          measurements: (req.query.measurements as string).split(','),
          nids: (req.query.nids as string)?.split(','),
          ntype: (req.query.ntype as string)?.split(','),
          every: req.query.every as string,
          fn: req.query.fn as string,
        };
        const rows = await influxService.queryNodeData(q);

        return res.json(rows);
      } catch (e) {
        logger.error('🔥 error: %o', e);
        return next(e);
      }
    },
  );

  // POST /node/cmd/all/:cmd
  route.post(
    '/cmd/all/:cmd',
    celebrate({
      [Segments.PARAMS]: Joi.object({
        cmd: Joi.string().required(),
      }),
    }),
    middlewares.isAuth,
    middlewares.attachCurrentUser,
    async (req: Request, res: Response, next: NextFunction) => {
      const logger: Logger = Container.get('logger');
      try {
        const mqttService = Container.get(MQTTService);
        const cmd = req.params.cmd;
        switch (cmd) {
          case 'trigger':
            mqttService.sendTriggerCommand();
            break;
          default:
        }
        return res.json({ success: 1 });
      } catch (e) {
        logger.error('🔥 error: %o', e);
        return next(e);
      }
    },
  );
  // POST /node/cmd/:nid/:cmd
  route.post(
    '/cmd/:ntype/:nid/:cmd',
    celebrate({
      [Segments.PARAMS]: Joi.object({
        nid: Joi.string().required(),
        ntype: Joi.string().required(),
        cmd: Joi.string().required(),
      }),
    }),
    middlewares.isAuth,
    middlewares.attachCurrentUser,
    async (req: Request, res: Response, next: NextFunction) => {
      const logger: Logger = Container.get('logger');
      try {
        const nodeRegistry = Container.get(NodeRegistryService);
        const node = nodeRegistry.get(+req.params.nid, +req.params.ntype);
        if (!node) {
          return res.status(404).json({ error: 'Node not found' });
        }
        const mqttService = Container.get(MQTTService);
        const cmd = req.params.cmd;
        switch (cmd) {
          case 'off':
            mqttService.sendTriggerCommand();
            break;
          default:
        }
        return res.json({ succes: 1 });
      } catch (e) {
        logger.error('🔥 error: %o', e);
        return next(e);
      }
    },
  );
};

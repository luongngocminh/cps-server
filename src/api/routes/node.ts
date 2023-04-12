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
            mqttService.broadcastTriggerCommand();
            break;
          case 'abort':
            mqttService.broadcastAbortCommand();
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
        nid: Joi.number().required(),
        ntype: Joi.number().required(),
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
            mqttService.broadcastTriggerCommand();
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

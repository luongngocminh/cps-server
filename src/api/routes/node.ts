import InfluxService from '@/services/influx';
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
};

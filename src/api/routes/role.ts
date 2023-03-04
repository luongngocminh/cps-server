import RoleService from '@/services/role';
import { celebrate, Joi } from 'celebrate';
import { Router, Request, Response, NextFunction } from 'express';
import Container from 'typedi';
import { Logger } from 'winston';
import middlewares from '../middlewares';
const route = Router();

export default (app: Router) => {
  app.use('/role', route);

  route.get(
    '/',
    middlewares.isAuth,
    middlewares.attachCurrentUser,
    async (req: Request, res: Response, next: NextFunction) => {
      const logger: Logger = Container.get('logger');
      const roleServices = Container.get(RoleService);

      try {
        return res.json(await roleServices.getAllRoles());
      } catch (e) {
        logger.error('🔥 error: %o', e);
        return next(e);
      }
    },
  );

  route.post(
    '/',
    celebrate({
      body: Joi.object({
        name: Joi.string().required(),
        perms: Joi.array().required(),
      }),
    }),
    middlewares.isAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      const logger: Logger = Container.get('logger');
      const roleServices = Container.get(RoleService);

      const { name, perms } = req.body;
      try {
        return res.json(await roleServices.addRole(name, perms));
      } catch (e) {
        logger.error('🔥 error: %o', e);
        return next(e);
      }
    },
  );
};

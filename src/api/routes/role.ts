import RoleService from '@/services/role';
import { PERMISSION } from '@/utils';
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
    middlewares.hasPerms([PERMISSION.ROLE.READ]),
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
    middlewares.isAuth,
    middlewares.hasPerms([PERMISSION.ROLE.WRITE]),
    celebrate({
      body: Joi.object({
        name: Joi.string().required(),
      }).unknown(true),
    }),
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

  route.post(
    '/update/:id',
    middlewares.isAuth,
    middlewares.hasPerms([PERMISSION.ROLE.WRITE]),
    celebrate({
      body: Joi.object({
        name: Joi.string().required(),
        perms: Joi.array().required(),
      }),
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const logger: Logger = Container.get('logger');
      const roleServices = Container.get(RoleService);

      const { name, perms } = req.body;
      const { id } = req.params;
      try {
        return res.json(await roleServices.updateRole(id, name, perms));
      } catch (e) {
        logger.error('🔥 error: %o', e);
        return next(e);
      }
    },
  );
};

import UserService from '@/services/user';
import { PERMISSION } from '@/utils';
import { celebrate, Joi } from 'celebrate';
import { Router, Request, Response, NextFunction } from 'express';
import Container from 'typedi';
import { Logger } from 'winston';
import middlewares from '../middlewares';
const route = Router();

export default (app: Router) => {
  app.use('/users', route);

  route.get('/me', middlewares.isAuth, middlewares.attachCurrentUser, (req: Request, res: Response) => {
    return res.json({ user: req.currentUser }).status(200);
  });

  route.get(
    '/',
    middlewares.isAuth,
    middlewares.hasPerms([PERMISSION.USER.READ]),
    async (req: Request, res: Response, next: NextFunction) => {
      const logger: Logger = Container.get('logger');
      const UserServiceInstance = Container.get(UserService);
      try {
        return res.json({ data: await UserServiceInstance.getAllUsers() }).status(200);
      } catch (e) {
        logger.error('🔥 error: %o', e);
        return next(e);
      }
    },
  );

  // CRUD User if only admin
  // Update User if only admin or self
  route.post(
    '/update',
    middlewares.isAuth,
    middlewares.hasPerms([PERMISSION.USER.READ, PERMISSION.USER.WRITE]),
    celebrate({
      body: Joi.object({
        id: Joi.string().required(),
        name: Joi.string().required(),
        email: Joi.string().required(),
      }),
    }),
    (req: Request, res: Response, next: NextFunction) => {
      const logger: Logger = Container.get('logger');
      const UserServiceInstance = Container.get(UserService);
      try {
        const { id, name, email, role } = req.body;
        const result = UserServiceInstance.updateUser(id, name, email, role);
        return res.json(result).status(200);
      } catch (e) {
        logger.error('🔥 error: %o', e);
        return next(e);
      }
    },
  );
  // Delete User if only admin
  // Whitelist User if only admin
  route.post(
    '/delete',
    middlewares.isAuth,
    middlewares.hasPerms([PERMISSION.USER.READ, PERMISSION.USER.WRITE]),
    (req: Request, res: Response, next: NextFunction) => {
      const logger: Logger = Container.get('logger');
      const UserServiceInstance = Container.get(UserService);
      try {
        const { id } = req.body;
        const result = UserServiceInstance.deleteUser(id);
        return res.json(result).status(200);
      } catch (e) {
        logger.error('🔥 error: %o', e);
        return next(e);
      }
    },
  );
};

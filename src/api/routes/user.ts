import UserService from '@/services/user';
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

  route.get('/', middlewares.isAuth, async (req: Request, res: Response, next: NextFunction) => {
    const logger: Logger = Container.get('logger');
    const UserServiceInstance = Container.get(UserService);
    try {
      return res.json({ data: await UserServiceInstance.getAllUsers() }).status(200);
    } catch (e) {
      logger.error('🔥 error: %o', e);
      return next(e);
    }
  });

  route.post(
    '/addRole',
    celebrate({
      body: Joi.object({
        id: Joi.string().required(),
        roleName: Joi.string().required(),
      }),
    }),
    middlewares.isAuth,
    (req: Request, res: Response, next: NextFunction) => {
      const logger: Logger = Container.get('logger');
      const UserServiceInstance = Container.get(UserService);
      try {
        const { id, roleName } = req.body;
        const result = UserServiceInstance.addRoleToUser(id, roleName);
        return res.json(result).status(200);
      } catch (e) {
        logger.error('🔥 error: %o', e);
        return next(e);
      }
    },
  );
};

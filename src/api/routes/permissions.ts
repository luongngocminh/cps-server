import { Router } from 'express';
import middlewares from '../middlewares';
import { PERMLIST } from '@/utils';

export default (app: Router) => {
  app.use('/permission', middlewares.isAuth, (req, res, next) => {
    return res.json(PERMLIST);
  });
};

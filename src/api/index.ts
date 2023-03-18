import { Router } from 'express';
import auth from './routes/auth';
import user from './routes/user';
import agendash from './routes/agendash';
import node from './routes/node';
import role from './routes/role';
import data from './routes/data';
import permissions from './routes/permissions';

// guaranteed to get dependencies
export default () => {
  const app = Router();
  auth(app);
  user(app);
  data(app);
  node(app);
  role(app);
  permissions(app);
  agendash(app);

  return app;
};

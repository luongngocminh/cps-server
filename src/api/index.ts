import { Router } from 'express';
import auth from './routes/auth';
import user from './routes/user';
import agendash from './routes/agendash';
import node from './routes/node';
import role from './routes/role';

// guaranteed to get dependencies
export default () => {
  const app = Router();
  auth(app);
  user(app);
  node(app);
  role(app);
  agendash(app);

  return app;
};

import { IUser } from '@/interfaces/IUser';
import { IRole } from '@/models/role';
import mongoose from 'mongoose';
import { Container } from 'typedi';
import { Logger } from 'winston';

const hasPerms = (perms: string[]) => {
  return async (req, res, next) => {
    const Logger: Logger = Container.get('logger');
    try {
      const UserModel = Container.get('userModel') as mongoose.Model<IUser & mongoose.Document>;
      type IUserWithRole = IUser & { role: IRole } & mongoose.Document;
      const userRecord = (await UserModel.findById(req.token._id).populate('role').exec()) as IUserWithRole;
      if (!userRecord) {
        return res.sendStatus(401);
      }
      const unauthorizedPermissions = perms.filter(p => (userRecord.role as IRole).perms.includes(p));
      if (unauthorizedPermissions.length > 0) {
        return res.sendStatus(401);
      }
      return next();
    } catch (e) {
      Logger.error('🔥 Error attaching user to req: %o', e);
      return next(e);
    }
  };
};

export default hasPerms;

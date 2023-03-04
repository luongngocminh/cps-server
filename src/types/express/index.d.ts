import { Document, Model } from 'mongoose';
import { IUser } from '@/interfaces/IUser';
import { IRole } from '@/interfaces/IRole';
import { INode } from '@/models/node';
declare global {
  namespace Express {
    export interface Request {
      currentUser: IUser & Document;
    }
  }

  namespace Models {
    export type UserModel = Model<IUser & Document>;
    export type NodeModel = Model<INode & Document>;
    export type RoleModel = Model<IRole & Document>;
    export type WhitelistModel = Model<{ email: string; addedBy: string } & Document>;
  }
}

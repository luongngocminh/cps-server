import { Document, Model } from 'mongoose';
import { IUser } from '@/interfaces/IUser';
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
  }
}

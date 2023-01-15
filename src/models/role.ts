import mongoose from 'mongoose';

export interface IRole {
  name: string;
}

const Role = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please enter a full name'],
      index: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model<IRole & mongoose.Document>('Role', Role);

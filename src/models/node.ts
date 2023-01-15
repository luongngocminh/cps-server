import mongoose from 'mongoose';

export interface INode {
  nid: number;
}

const Node = new mongoose.Schema(
  {
    nid: {
      type: Number,
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model<INode & mongoose.Document>('Node', Node);

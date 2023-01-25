import mongoose from 'mongoose';

export interface INode {
  nid: number;
  status: number; // 0: connected, 1: disconnected
  type: number; // Node type: 0 - sensor, 1 - station

  latestConnectedAt: Date;
  battery?: number;
  rtc?: number;
  temperature?: number;

  createdAt?: Date;
  updatedAt?: Date;
}

const Node = new mongoose.Schema(
  {
    nid: {
      type: Number,
      required: true,
      index: true,
    },
    latestConnectedAt: { type: Date, required: true, default: new Date() },
    type: {
      // Node type: 0 - sensor, 1 - station
      type: Number,
      required: true,
      index: true,
    },
    status: {
      type: Number,
      default: 0,
    },
    battery: {
      type: Number,
    },
    rtc: {
      type: Number,
    },
    temperature: {
      type: Number,
    },
  },
  { timestamps: true },
);

export default mongoose.model<INode & mongoose.Document>('Node', Node);

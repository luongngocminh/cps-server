import mongoose from 'mongoose';

interface IWhitelist {
  email: string;
  addedBy: string;
}

const Whitelist = new mongoose.Schema(
  {
    email: {
      type: String,
      lowercase: true,
      unique: true,
      index: true,
    },
    addedBy: {
      type: mongoose.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
);

export default mongoose.model<IWhitelist & mongoose.Document>('Whitelist', Whitelist);

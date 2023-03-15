export enum IPacketType {
  CONN,
  DISCONN,
  INFO,
  DATA,
  CMD,
}

export enum IPacketStatus {
  OK,
  ERR,
}

export interface IBytesPacket {
  version: number;
  node: {
    id: number;
    type: number;
    parent?: number;
  };
  type: IPacketType;
  status: IPacketStatus;
  ts: number;
  data: Uint8Array;
  id: string;
}

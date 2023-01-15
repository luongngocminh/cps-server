export enum IPacketType {
  REQ,
  RES,
  INFO,
  DATA,
  CONN,
  DISCONN,
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
  };
  type: IPacketType;
  status: IPacketStatus;
  ts: number;
  data: unknown;
  id: string;
}

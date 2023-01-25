export enum TOPICS {
  SVR_IN = 'svr/in',
  SVR_OUT = 'svr/out',
}
export function uint8arr2int(arr: Uint8Array): number {
  const view = new DataView(arr.buffer, 0);
  return view.getInt32(0, true); // true here represents little-endian
}
export function getNodeKey(nid: number, type: number) {
  const keyPrefixMap = {
    0: 'ss',
    1: 'st',
  };
  const keyPrefix = keyPrefixMap[type];
  const key = `${keyPrefix}-${nid}`;
  return key;
}

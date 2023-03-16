export enum TOPICS {
  SVR_IN = 'svr/in',
  SVR_OUT = 'svr/out',
}
export function uint8arr2int(arr: Uint8Array, get16 = false): number {
  const view = new DataView(arr.buffer, 0);
  if (get16) {
    return view.getInt16(0, true);
  }
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

// function flatten all values in an object
export function flattenValues(obj: any) {
  const result = [];

  function runner(obj: any, res) {
    for (const value of Object.values(obj)) {
      if (typeof value === 'object') {
        runner(value, res);
      } else {
        result.push(value);
      }
    }
  }
  runner(obj, result);
  return result;
}

export const PERMISSION = {
  NODE: {
    READ: 'NODE:READ',
    READ_ALL: 'NODE:READ:ALL',
  },
  USER: {
    READ: 'USER:READ',
    WRITE: 'USER:WRITE',
  },
  SYSTEM: {
    READ: 'SYSTEM:READ',
    WRITE: 'SYSTEM:WRITE',
  },
};

export const PERMLIST = flattenValues(PERMISSION);

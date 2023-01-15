export function uint8arr2int(arr: Uint8Array): number {
  const view = new DataView(arr.buffer, 0);
  return view.getUint32(0, true); // true here represents little-endian
}

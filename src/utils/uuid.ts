import { webcrypto } from "node:crypto";
export const randomUUID = (unsigned: boolean = true) =>
  unsigned ? toUnsignedUUID(webcrypto.randomUUID()) : webcrypto.randomUUID();

export const toUnsignedUUID = (uuid: string) => uuid.replace(/-/g, "");

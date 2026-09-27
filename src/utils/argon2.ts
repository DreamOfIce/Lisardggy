import { hash, verify as _verify } from "@node-rs/argon2";

import { YggdrasilServer } from "../server";

export namespace Argon2 {
  export const calc = (password: string, config: YggdrasilServer.Config) =>
    hash(password, {
      ...config.authServer.argon2,
      algorithm: 2, // Algorithm.Argon2id
      version: 1, // Version.V0x13
      outputLen: 32,
    });

  export const verify = (password: string, hashedPassword: string) =>
    _verify(hashedPassword, password);
}

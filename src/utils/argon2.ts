import { hash as _hash, verify as _verify, ParsedHashOptions, parseOptions } from "@node-rs/argon2";
import { deepEqual } from "cosmokit";

import { YggdrasilServer } from "../server";

export namespace Argon2 {
  export const compareOptions = (hashed: string, config: YggdrasilServer.Config) => {
    const parsedOptions = parseOptions(hashed);
    const currentOptions: ParsedHashOptions = {
      ...config.auth.argon2,
      algorithm: 2, // Algorithm.Argon2id
      version: 1, // Version.V0x13
      outputLen: 32,
      saltLen: 16,
    };
    return deepEqual(parsedOptions, currentOptions);
  };

  export const hash = (password: string, config: YggdrasilServer.Config) =>
    _hash(password, {
      ...config.auth.argon2,
      algorithm: 2, // Algorithm.Argon2id
      version: 1, // Version.V0x13
      outputLen: 32,
    });

  export const verify = (password: string, hashed: string) => _verify(hashed, password);
}

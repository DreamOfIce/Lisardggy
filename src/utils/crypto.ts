import { webcrypto } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { hash as _hash, verify as _verify, ParsedHashOptions, parseOptions } from "@node-rs/argon2";
import { arrayBufferToBase64, Binary, deepEqual, omit } from "cosmokit";
import type { FastifyBaseLogger } from "fastify";

import { YggdrasilServerConfig } from "../config";

export namespace Argon2 {
  export const compareOptions = (hashed: string, config: YggdrasilServerConfig) => {
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

  export const hash = (password: string, config: YggdrasilServerConfig) =>
    _hash(password, {
      ...config.auth.argon2,
      algorithm: 2, // Algorithm.Argon2id
      version: 1, // Version.V0x13
      outputLen: 32,
    });

  export const verify = (password: string, hashed: string) => _verify(hashed, password);
}

export namespace Keys {
  export const exportPEM = async (key: CryptoKey): Promise<string> => {
    if (key.type === "secret")
      return arrayBufferToBase64(await webcrypto.subtle.exportKey("raw", key));
    const body = arrayBufferToBase64(
      await webcrypto.subtle.exportKey(key.type === "public" ? "spki" : "pkcs8", key),
    );
    return `-----BEGIN ${key.type.toUpperCase()} KEY-----\n${body}\n-----END ${key.type.toUpperCase()} KEY-----`;
  };

  export const generatePublicKey = async (key: CryptoKey) => {
    if (key.type !== "private") return key;
    const { algorithm, usages } = key;
    const jwk = await webcrypto.subtle.exportKey("jwk", key);
    const pubKeyUsages = usages
      .map((usage) => {
        switch (usage) {
          case "sign":
            return "verify";
          case "decrypt":
            return "encrypt";
          case "unwrapKey":
            return "wrapKey";
          default:
            return;
        }
      })
      .filter((usage) => usage !== undefined);
    const pubKey = omit(jwk, ["d", "p", "q", "dp", "dq", "qi"]);
    if (pubKey.key_ops) pubKey.key_ops = pubKeyUsages;
    return await webcrypto.subtle.importKey("jwk", pubKey, algorithm, true, pubKeyUsages);
  };

  export const loadKeys = async (
    keyOptions: { key?: string; keyPath?: string },
    algo:
      | webcrypto.RsaHashedKeyGenParams
      | webcrypto.EcKeyGenParams
      | webcrypto.AlgorithmIdentifier,
    logger: FastifyBaseLogger,
  ): Promise<webcrypto.CryptoKeyPair> => {
    const { key, keyPath } = keyOptions;
    let keyString = key;
    try {
      if (!key && keyPath) keyString = await readFile(keyPath, "ascii");
    } catch (err) {
      if (!(err instanceof Error && Reflect.get(err, "code") === "ENOENT")) {
        logger.error(`Failed to read keys from ${keyPath!}`);
        process.exit(1);
      }
    }
    if (keyString) {
      const body = keyString
        .trim()
        .match(/^-----BEGIN PRIVATE KEY-----(.+)-----END PRIVATE KEY-----$/s)?.[1]
        ?.trim()
        .replace(/\s/g, "");
      if (!body) {
        logger.error("Failed to parse the private key");
        process.exit(1);
      }
      const privateKey = await webcrypto.subtle.importKey(
        "pkcs8",
        Binary.fromBase64(body),
        algo,
        true,
        ["sign"],
      );
      const publicKey = await generatePublicKey(privateKey);
      return { publicKey, privateKey };
    } else if (keyPath) {
      logger.info("key %s not found, start generation...", keyPath);
      const { publicKey, privateKey } = (await webcrypto.subtle.generateKey(algo, true, [
        "sign",
        "verify",
      ])) as webcrypto.CryptoKeyPair;
      const privKey = await exportPEM(privateKey);
      await writeFile(keyPath, privKey, { mode: 400 });
      logger.info("private key has been written to %s", keyPath);
      return { publicKey, privateKey };
    } else {
      logger.error("Private key not provided");
      process.exit(1);
    }
  };
}

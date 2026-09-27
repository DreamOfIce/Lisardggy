import { webcrypto } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { relative } from "node:path";
import { exit, loadEnvFile } from "node:process";

import { arrayBufferToBase64 } from "cosmokit";
import type { FastifyBaseLogger } from "fastify";

import { AuthServerOptions } from "../config";

export const deepMerge = <T>(...objects: T[]): T => {
  if (objects.length <= 1) {
    return objects[0]!;
  } else if (objects.length > 2) {
    const lastObject = objects.pop()!;
    return objects.reduceRight(
      (currentObject, nextObject) => deepMerge(nextObject, currentObject),
      lastObject,
    );
  }
  const [object1, object2] = objects as [T, T];
  if (isPlainObject(object1) && isPlainObject(object2)) {
    return Object.fromEntries(
      new Set([...Object.keys(object1), ...Object.keys(object2)])
        .values()
        .map((key) => [key, deepMerge(Reflect.get(object1, key), Reflect.get(object2, key))]),
    ) as T;
  } else if (object1 === null || object1 === undefined) {
    return object2;
  } else {
    return object1;
  }
};

/**
 * export key in pem format
 */
export const exportKey = async (key: CryptoKey): Promise<string> => {
  if (key.type === "secret")
    return arrayBufferToBase64(await webcrypto.subtle.exportKey("raw", key));
  const body = arrayBufferToBase64(
    await webcrypto.subtle.exportKey(key.type === "public" ? "spki" : "pkcs8", key),
  );
  return `-----BEGIN ${key.type.toUpperCase()} KEY-----\n${body}\n-----END ${key.type.toUpperCase()} KEY-----`;
};

export const isPlainObject = <T>(data: T): data is object & T =>
  typeof data === "object" && data !== null && !Array.isArray(data);

export const loadEnvFiles = (extraEnvFiles: string | string[] | undefined = []) => {
  const envFiles = typeof extraEnvFiles === "string" ? [extraEnvFiles] : extraEnvFiles;
  envFiles.toReversed().forEach((file) => {
    try {
      loadEnvFile(file);
    } catch (err) {
      console.error(`Failed to load env from ${file}`);
      throw err;
    }
  });
  if (envFiles.every((file) => relative(file, ".env").length !== 0))
    try {
      loadEnvFile();
    } catch {
      /* void */
    }
};

export const loadOrGenerateKeys = async (
  { publicKey, publicKeyPath, privateKey, privateKeyPath }: AuthServerOptions["jwt"],
  logger: FastifyBaseLogger,
): Promise<[string, string]> => {
  let pubKey = publicKey,
    privKey = privateKey,
    pubKeyNotExist = false,
    privKeyNotExist = false;
  try {
    if (!pubKey && publicKeyPath) pubKey ??= await readFile(publicKeyPath, "ascii");
  } catch (err) {
    if (err instanceof Error && Reflect.get(err, "code") === "ENOENT") pubKeyNotExist = true;
    else throw err;
  }
  try {
    if (!privKey && privateKeyPath) privKey ??= await readFile(privateKeyPath, "ascii");
  } catch (err) {
    if (err instanceof Error && Reflect.get(err, "code") === "ENOENT") privKeyNotExist = true;
    else throw err;
  }
  if (pubKey && privKey) {
    return [pubKey, privKey];
  } else if (pubKeyNotExist && privKeyNotExist) {
    const { publicKey, privateKey } = (await webcrypto.subtle.generateKey("Ed25519", true, [
      "sign",
      "verify",
    ])) as webcrypto.CryptoKeyPair;
    const pubKey = await exportKey(publicKey);
    const privKey = await exportKey(privateKey);
    await writeFile(publicKeyPath!, pubKey, { mode: 400 });
    await writeFile(privateKeyPath!, privKey, { mode: 400 });
    logger.warn(`private key has been written to ${publicKeyPath!}`);
    logger.warn(`private key has been written to ${privateKeyPath!}`);
    return [pubKey, privKey];
  } else {
    logger.error(`JWT public key and/or private key not provided!`);
    return exit(1);
  }
};

import { relative } from "node:path";
import { loadEnvFile } from "node:process";

import ipaddr from "ipaddr.js";

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

export const formatIP = (ip: string) => ipaddr.process(ip).toString();

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

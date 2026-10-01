import { readFileSync } from "node:fs";
import { env } from "node:process";

import { omit, snakeCase } from "cosmokit";
import type { FastifyServerOptions } from "fastify";
import type { TransportTargetOptions } from "pino";
import type { PinoRollOptions } from "pino-roll";
import Schema from "schemastery";

import { YggdrasilServer } from "../server";
import { deepMerge } from "./misc";
import type { DeepPartial } from "./types";

export const generateFastifyOptions = (config: YggdrasilServer.Config) => {
  const options: FastifyServerOptions = {
    routerOptions: { ignoreDuplicateSlashes: true },
  };

  if (config.https) {
    Object.assign(options, {
      https: {
        cert: readFileSync(config.https.cert, { encoding: "ascii" }),
        key: readFileSync(config.https.key, { encoding: "ascii" }),
        allowHTTP1: true,
      },
      http2: true,
    });
  }
  const targets: TransportTargetOptions[] = [];
  if (config.logger.console.enabled) {
    const { level, prettyPrint } = config.logger.console;
    targets.push({
      level,
      target: prettyPrint ? "pino-pretty" : "pino/file",
      options: {
        destination: 1,
      },
    });
  }
  if (config.logger.file.enabled) {
    const { level, path, roll } = config.logger.file;
    const target: TransportTargetOptions<PinoRollOptions> = {
      level,
      target: "pino-roll",
      options: {
        file: path,
        mkdir: true,
        ...omit(roll, ["maxCount"]),
      },
    };
    if (roll.maxCount) target.options!.limit = { count: roll.maxCount };
    targets.push(target);
  }
  switch (targets.length) {
    case 0:
      options.logger = false;
      break;
    case 1:
      options.logger = { level: targets[0]!.level!, transport: { targets } };
      break;
    default:
      options.logger = {
        level: "trace",
        transport: {
          targets,
        },
      };
      break;
  }
  return options;
};

export const loadConfigFromEnv = <T>(
  prefix: string,
  schema: Schema<T>,
): DeepPartial<T> | undefined => {
  let result;
  switch (schema.type) {
    case "array":
    case "tuple":
      result = env[prefix]?.split(/(?<!,\\)/);
      break;
    case "boolean":
      result = env[prefix] === "true" ? true : env[prefix] === "false" ? false : env[prefix];
      break;
    case "dict":
      result = env[prefix] ? (JSON.parse(env[prefix]) as DeepPartial<T>) : env[prefix];
      break;
    case "number":
      result = env[prefix]
        ? Number.isNaN(+env[prefix])
          ? env[prefix]
          : +env[prefix]
        : env[prefix];
      break;
    case "intersect":
      result = deepMerge(...schema.list!.map((s): unknown => loadConfigFromEnv(prefix, s)));
      break;
    case "object":
      result = Object.fromEntries(
        Object.entries(schema.dict!)
          .map(([k, s]) => {
            const c: unknown = loadConfigFromEnv(`${prefix}_${snakeCase(k).toUpperCase()}`, s);
            if (c === undefined) return undefined;
            else return [k, c];
          })
          .filter((v) => v !== undefined),
      ) as object;
      if (Object.keys(result).length === 0) result = undefined;
      break;
    case "transform":
      result = loadConfigFromEnv<T>(prefix, schema.inner!);
      break;
    case "union":
      result = deepMerge(
        ...schema
          .list!.filter(({ type }) => !env[prefix] || type !== "object")
          .map((s): unknown => loadConfigFromEnv(prefix, s)),
      );
      break;
    default:
      result = env[prefix];
      break;
  }
  return result as DeepPartial<T>;
};

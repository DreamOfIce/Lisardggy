import { join } from "node:path";
import { cwd } from "node:process";

import { parse } from "@lukeed/ms";
import type { LogLevel } from "fastify";
import Schema from "schemastery";

export type { LogLevel } from "fastify";
export const logLevel: Schema<LogLevel> = Schema.union([
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
]);

export interface DatabaseOptions {
  path: string;
}
export interface LoggerOptions {
  console: ConsoleLoggerOptions;
  file: FileLoggerOptions;
}
export interface ConsoleLoggerOptions {
  enabled: boolean;
  level: LogLevel;
  prettyPrint: boolean;
}
export interface FileLoggerOptions {
  enabled: boolean;
  level: LogLevel;
  path: string;
  roll: {
    frequency?: "daily" | "hourly" | number;
    size?: number | string;
    maxCount?: number;
  };
}

export interface ManagementAPIOptions {
  enabled: boolean;
  allow: (string | RegExp)[];
}

export interface AuthServerOptions {
  argon2: {
    memoryCost: number;
    parallelism: number;
    timeCost: number;
  };
  jwt: JWTOptions;
  rateLimit: {
    max: number;
    timeWindow: string;
  };
}

export interface JWTOptions {
  expires: number;
  outdate: number;
  revocationListGCInterval: number;
  maxTokens: number;
  publicKey?: string;
  publicKeyPath?: string;
  privateKey?: string;
  privateKeyPath?: string;
}

export interface YggdrasilServerConfig {
  host: string;
  port: number;
  https: false | { cert: string; key: string };
  database: DatabaseOptions;
  logger: LoggerOptions;
  managementAPI: false | { allow: (string | RegExp)[] };
  officalServer: {
    profile: string;
    session: string;
  };
  passThrough: boolean;
  serverInfo: {
    name: string;
    homepage?: string;
    register?: string;
  };
  authServer: AuthServerOptions;
}

const defaultLoggerConfig = {
  console: { enabled: true, level: "info", prettyPrint: true },
  file: {
    enabled: false,
    level: "info",
    path: join(cwd(), "data", "logs", "yggdrasil"),
    roll: {
      frequency: "daily",
      size: "1M",
      maxCount: 100,
    },
  },
} satisfies LoggerOptions;

export const YggdrasilServerConfig: Schema<YggdrasilServerConfig> = Schema.object({
  host: Schema.string().default("0.0.0.0").description("HTTP address to bind"),
  port: Schema.natural().max(65535).default(8008).description("HTTP port to listen"),
  https: Schema.union([
    Schema.const(false),
    Schema.object({
      cert: Schema.string().required(),
      key: Schema.string().required(),
    }),
  ])
    .default(false)
    .description("HTTPS certificate options"),
  database: Schema.object({
    path: Schema.string().default(join(cwd(), "data", "db.json")),
  }).description("Database options"),
  logger: Schema.union([
    Schema.transform(Schema.boolean(), (v): LoggerOptions => ({
      ...defaultLoggerConfig,
      console: { ...defaultLoggerConfig.console, enabled: v },
    })),
    Schema.object({
      console: Schema.union([
        Schema.transform(Schema.boolean(), (v): ConsoleLoggerOptions => ({
          ...defaultLoggerConfig.console,
          enabled: v,
        })),
        Schema.object({
          enabled: Schema.boolean().default(defaultLoggerConfig.console.enabled),
          level: logLevel.default(defaultLoggerConfig.console.level),
          prettyPrint: Schema.boolean().default(defaultLoggerConfig.console.prettyPrint),
        }),
      ]).default(defaultLoggerConfig.console),
      file: Schema.union([
        Schema.transform(Boolean, (v): FileLoggerOptions => ({
          ...defaultLoggerConfig.file,
          enabled: v,
        })),
        Schema.object({
          enabled: Schema.boolean().default(defaultLoggerConfig.file.enabled),
          level: logLevel.default("info"),
          path: Schema.string().default(defaultLoggerConfig.file.path),
          roll: Schema.object({
            frequency: Schema.union(["daily", "hourly", Schema.number()]),
            size: Schema.union([Schema.string(), Schema.number()]),
            maxCount: Schema.natural(),
          }).default(defaultLoggerConfig.file.roll),
        }),
      ]).default(defaultLoggerConfig.file),
    }),
  ])
    .default(defaultLoggerConfig)
    .description("Logger options"),
  managementAPI: Schema.union([
    Schema.const(false),
    Schema.object({
      allow: Schema.array(
        Schema.transform(Schema.string(), (s) =>
          /\/.+\//.test(s) ? new RegExp(s.slice(1, -1)) : s,
        ) as Schema<string | RegExp>,
      ).default(["127.0.0.1", "::1"]),
    }),
  ])
    .default(false)
    .description("Management API options"),
  officalServer: Schema.object({
    profile: Schema.string().default("https://api.mojang.com"),
    session: Schema.string().default("https://sessionserver.mojang.com"),
  }).description("Custom URLs of Mojang auth server"),
  passThrough: Schema.boolean().description("Pass through unknown account to Mojang auth server"),
  serverInfo: Schema.object({
    name: Schema.string().default("Yet Another Yggdrasil Server"),
    homepage: Schema.string(),
    register: Schema.string(),
  }).description("Server infos displayed to users"),
  authServer: Schema.object({
    argon2: Schema.object({
      memoryCost: Schema.natural().min(1).default(32768),
      parallelism: Schema.natural().min(1).default(1),
      timeCost: Schema.natural().min(1).default(8),
    }),
    jwt: Schema.object({
      expires: Schema.union([
        Schema.transform(Schema.string(), (t) => parse(t)! / 1000),
        Schema.number(),
      ]).default(15552000), // 180 days
      outdate: Schema.union([
        Schema.transform(Schema.string(), (t) => parse(t)! / 1000),
        Schema.number(),
      ]).default(7776000), // 60 days
      revocationListGCInterval: Schema.union([
        Schema.transform(Schema.string(), (t) => parse(t)! / 1000),
        Schema.number(),
      ]).default(3600), // 1 hour
      maxTokens: Schema.natural().min(1).default(30),
      publicKey: Schema.string(),
      publicKeyPath: Schema.string().default(join(cwd(), "data", "public.key")),
      privateKey: Schema.string(),
      privateKeyPath: Schema.string().default(join(cwd(), "data", "private.key")),
    }),
    rateLimit: Schema.object({
      max: Schema.natural().default(20),
      timeWindow: Schema.string().default("30min"),
    }),
  }).description("Authenticate server options"),
}).description("Yggdrasil server configuration");

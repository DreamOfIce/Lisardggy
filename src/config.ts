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
  jwt: {
    expires: number;
    outdate: number;
    maxTokens: number;
    key?: string;
    keyPath?: string;
  };
  rateLimit: {
    max: number;
    timeWindow: string;
  };
}

export interface SkinServerOptions {
  baseUrl: string;
  savePath: string;
  maxFileSize: number;
  maxWidth: {
    cape: number;
    skin: number;
  };
}

export interface LisardggyConfig {
  host: string;
  port: number;
  https: false | { cert: string; key: string };
  database: DatabaseOptions;
  fallback: {
    passThrough: boolean;
    apiServer: string;
    minecraftServices: string;
    sessionServer: string;
    texturesServer: string;
    proxy?: string;
  };
  logger: LoggerOptions;
  managementAPI: false | { allow: (string | RegExp)[] };
  metadata: {
    name: string;
    homepage?: string;
    register?: string;
  };
  signature: {
    key?: string;
    keyPath?: string;
  };
  auth: AuthServerOptions;
  skin: SkinServerOptions;
}

const defaultLoggerConfig = {
  console: { enabled: true, level: "info", prettyPrint: true },
  file: {
    enabled: false,
    level: "info",
    path: join(cwd(), "data", "logs", "lisardggy"),
    roll: {
      frequency: "daily",
      size: "1M",
      maxCount: 100,
    },
  },
} satisfies LoggerOptions;

export const LisardggyConfig: Schema<LisardggyConfig> = Schema.object({
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
  fallback: Schema.object({
    passThrough: Schema.boolean().default(false),
    apiServer: Schema.string().default("https://api.mojang.com"),
    minecraftServices: Schema.string().default("https://api.minecraftservices.com"),
    sessionServer: Schema.string().default("https://sessionserver.mojang.com"),
    texturesServer: Schema.string().default("http://textures.minecraft.net/"),
    proxy: Schema.string(),
  }).description("Fallback server options"),
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
  metadata: Schema.object({
    name: Schema.string().default("Yet Another Yggdrasil Server"),
    homepage: Schema.string(),
    register: Schema.string(),
  }).description("Information displayed to users"),
  signature: Schema.object({
    key: Schema.string(),
    keyPath: Schema.string().default(join(cwd(), "data", "sign.key")),
  }),
  auth: Schema.object({
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
      maxTokens: Schema.natural().min(1).default(30),
      key: Schema.string(),
      keyPath: Schema.string().default(join(cwd(), "data", "jwt.key")),
    }),
    rateLimit: Schema.object({
      max: Schema.natural().default(20),
      timeWindow: Schema.string().default("30min"),
    }),
  }).description("Authenticate server options"),
  skin: Schema.object({
    baseUrl: Schema.string().default("/skins/"),
    savePath: Schema.string().default(join(cwd(), "data", "skins")),
    maxFileSize: Schema.natural().default(1048576), // 1MB
    maxWidth: Schema.object({
      cape: Schema.natural().min(64).step(64).default(64),
      skin: Schema.natural().min(64).step(64).default(64),
    }),
  }).description("Skin server options"),
}).description("Lisardggy server configuration");

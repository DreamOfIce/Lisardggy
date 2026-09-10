import { join } from "node:path";

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

export interface YggdrasilServerConfig {
  host: string;
  port: number;
  database: {
    path: string;
  };
  logger: LoggerOptions;
  managementAPI: ManagementAPIOptions;
  officalServer: {
    profile: string;
    session: string;
  };
  passThrough: boolean;
}

const defaultConfig = {
  host: "0.0.0.0",
  port: 8008,
  database: { path: join("db.json") },
  logger: {
    console: { enabled: true, level: "info", prettyPrint: true },
    file: {
      enabled: false,
      level: "info",
      path: join("logs", "yggdrasil"),
      roll: {
        frequency: "daily",
        size: "1M",
        maxCount: 100,
      },
    },
  },
  managementAPI: { enabled: true, allow: ["127.0.0.1", "::1"] },
  officalServer: {
    profile: "https://api.mojang.com",
    session: "https://sessionserver.mojang.com",
  },
  passThrough: false,
} satisfies YggdrasilServerConfig;

export const YggdrasilServerConfig: Schema<YggdrasilServerConfig> = Schema.object({
  host: Schema.string().default(defaultConfig.host).description("HTTP address to bind"),
  port: Schema.number().default(defaultConfig.port).description("HTTP port to listen"),
  database: Schema.object({ path: Schema.string().default(defaultConfig.database.path) })
    .default(defaultConfig.database)
    .description("Database options"),
  logger: Schema.union([
    Schema.transform(Boolean, (v): LoggerOptions => ({
      ...defaultConfig.logger,
      console: { ...defaultConfig.logger.console, enabled: v },
    })),
    Schema.object({
      console: Schema.union([
        Schema.transform(Schema.boolean(), (v): ConsoleLoggerOptions => ({
          ...defaultConfig.logger.console,
          enabled: v,
        })),
        Schema.object({
          enabled: Schema.boolean().default(defaultConfig.logger.console.enabled),
          level: logLevel.default(defaultConfig.logger.console.level),
          prettyPrint: Schema.boolean().default(defaultConfig.logger.console.prettyPrint),
        }),
      ]).default(defaultConfig.logger.console),
      file: Schema.union([
        Schema.transform(Boolean, (v): FileLoggerOptions => ({
          ...defaultConfig.logger.file,
          enabled: v,
        })),
        Schema.object({
          enabled: Schema.boolean().default(defaultConfig.logger.file.enabled),
          level: logLevel.default(defaultConfig.logger.file.level),
          path: Schema.transform(Schema.string(), (s) => join(s)).default(
            defaultConfig.logger.file.path,
          ),
          roll: Schema.object({
            frequency: Schema.union(["daily", "hourly", Schema.number()]),
            size: Schema.union([Schema.string(), Schema.number()]),
            maxCount: Schema.number(),
          }).default(defaultConfig.logger.file.roll),
        }),
      ]).default(defaultConfig.logger.file),
    }),
  ])
    .default(defaultConfig.logger)
    .description("Logger options"),
  managementAPI: Schema.union([
    Schema.transform(Boolean, (v) => ({ ...defaultConfig.managementAPI, enabled: v })),
    Schema.object({
      enabled: Schema.boolean().default(defaultConfig.managementAPI.enabled),
      allow: Schema.array(
        Schema.transform(Schema.string(), (s) =>
          /\/.+\//.test(s) ? new RegExp(s.slice(1, -1)) : s,
        ) as Schema<string | RegExp>,
      ).default(defaultConfig.managementAPI.allow),
    }),
  ])
    .default(defaultConfig.managementAPI)
    .description("Management API options"),
  officalServer: Schema.object({
    profile: Schema.string().default(defaultConfig.officalServer.profile),
    session: Schema.string().default(defaultConfig.officalServer.session),
  })
    .default(defaultConfig.officalServer)
    .description("custom URLs of Mojang auth server"),
  passThrough: Schema.boolean()
    .default(defaultConfig.passThrough)
    .description("Pass through unknown account to Mojang auth server"),
}).required();

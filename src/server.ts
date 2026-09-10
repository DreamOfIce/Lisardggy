import { omit } from "cosmokit";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import type { TransportTargetOptions } from "pino";
import type { PinoRollOptions } from "pino-roll";

import { YggdrasilServerConfig } from "./config";
import { databasePlugin } from "./database";
import { sessionServer } from "./libs";

export class YggdrasilServer {
  public config: YggdrasilServer.Config;
  private server: FastifyInstance;
  private logger: FastifyBaseLogger;
  constructor(config: Partial<YggdrasilServer.Config> = {}) {
    //@ts-expect-error ts2345 Schemastery allow partial input
    this.config = new YggdrasilServer.Config(config);

    const loggerOptions = {
      level: "trace",
      transport: {
        targets: [] as TransportTargetOptions[],
      },
    };

    if (this.config.logger.console.enabled) {
      const { level, prettyPrint } = this.config.logger.console;
      loggerOptions.transport.targets.push({
        level,
        target: prettyPrint ? "pino-pretty" : "pino/file",
        options: {
          destination: 1,
        },
      });
    }
    if (this.config.logger.file.enabled) {
      const { level, path, roll } = this.config.logger.file;
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
      loggerOptions.transport.targets.push(target);
    }
    this.server = Fastify({ logger: loggerOptions });
    this.logger = this.server.log.child({ label: "yggdrasil" });
    this.logger.debug(this.config);
    this.server.register(databasePlugin, { path: this.config.database.path });
    this.server.register(sessionServer, {
      prefix: "/sessionserver",
      officalServerURL: this.config.officalServer.session,
      passThrough: this.config.passThrough,
    });
  }
  public async start() {
    const { host, port } = this.config;
    await this.server.listen({ host, port });
  }
}

export namespace YggdrasilServer {
  // oxlint-disable-next-line typescript/no-empty-object-type
  export interface Config extends YggdrasilServerConfig {}
  export const Config = YggdrasilServerConfig;
}

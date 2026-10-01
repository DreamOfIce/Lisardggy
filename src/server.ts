import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import { schemasteryPlugin, type SchemasteryTypeProvider } from "fastify-type-provider-schemastery";

import { YggdrasilServerConfig } from "./config";
import { errorHandler } from "./error";
import { aliasPlugin, databasePlugin, jwtPlugin } from "./plugins";
import { routes } from "./route";
import { generateFastifyOptions, type DeepPartial } from "./utils";

export class YggdrasilServer {
  public config: YggdrasilServer.Config;
  private server: FastifyInstance;
  private logger: FastifyBaseLogger;
  constructor(config: DeepPartial<YggdrasilServer.Config> = {}) {
    //@ts-expect-error ts2345 Schemastery allow partial input
    this.config = new YggdrasilServer.Config(config);

    this.server = Fastify(
      generateFastifyOptions(this.config),
    ).withTypeProvider<SchemasteryTypeProvider>();

    this.logger = this.server.log.child({}, { msgPrefix: "[Yggdrasil] " });
    this.logger.debug(`server Configuration:\n%o`, this.config);
    this.server
      .register(aliasPlugin)
      .register(databasePlugin, this.config.database)
      .register(schemasteryPlugin)
      .register(jwtPlugin, this.config)
      .register(routes, this.config);
    this.server.setErrorHandler(errorHandler);
  }

  public async start() {
    const { host, port } = this.config;
    this.logger.info(`Starting server on port ${port.toString()}...`);
    await this.server.listen({ host, port });
  }

  public async stop() {
    this.logger.info("Stoping server...");
    await this.server.close();
  }
}

export namespace YggdrasilServer {
  // oxlint-disable-next-line typescript/no-empty-object-type
  export interface Config extends YggdrasilServerConfig {}
  export const Config = YggdrasilServerConfig;
}

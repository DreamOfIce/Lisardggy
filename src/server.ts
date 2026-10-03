import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import type { SchemasteryTypeProvider } from "fastify-type-provider-schemastery";

import { LisardggyConfig } from "./config";
import { errorHandler } from "./error";
import { registerPlugins } from "./plugin";
import { routes } from "./route";
import { generateFastifyOptions, type DeepPartial } from "./utils";

export class Lisardggy {
  public config: Lisardggy.Config;
  private server: FastifyInstance;
  private logger: FastifyBaseLogger;
  constructor(config: DeepPartial<Lisardggy.Config> = {}) {
    //@ts-expect-error ts2345 Schemastery allow partial input
    this.config = new Lisardggy.Config(config);

    this.server = Fastify(
      generateFastifyOptions(this.config),
    ).withTypeProvider<SchemasteryTypeProvider>();

    this.logger = this.server.log.child({}, { msgPrefix: "[lisardggy] " });
    this.logger.debug("server Configuration:\n%o", this.config);
    registerPlugins(this.server, this.config);
    this.server.register(routes, this.config);
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

export namespace Lisardggy {
  // oxlint-disable-next-line typescript/no-empty-object-type
  export interface Config extends LisardggyConfig {}
  export const Config = LisardggyConfig;
}

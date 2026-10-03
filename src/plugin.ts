import type { FastifyInstance } from "fastify";
import { schemasteryPlugin } from "fastify-type-provider-schemastery";

import type { LisardggyConfig } from "./config";
import { databasePlugin, aliasPlugin, jwtPlugin, skinPlugin } from "./plugins";

export const registerPlugins = (instance: FastifyInstance, config: LisardggyConfig) => {
  instance
    .register(schemasteryPlugin)
    .register(aliasPlugin)
    .register(databasePlugin, config)
    .register(jwtPlugin, config)
    .register(skinPlugin, config);
};

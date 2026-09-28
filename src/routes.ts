import { omit } from "cosmokit";
import type { FastifyInstance } from "fastify";

import { name, version } from "../package.json";
import type { YggdrasilServerConfig } from "./config";
import { authServer, sessionServer } from "./libs";
import { API } from "./schemas";

export const registerRoutes = (fastify: FastifyInstance, config: YggdrasilServerConfig) => {
  fastify.register(authServer, config);
  fastify.register(sessionServer, config);
  fastify.get("/", { schema: { response: { 200: API.MetaData } } }, () => ({
    meta: {
      serverName: config.serverInfo.name,
      implementationName: name,
      implementationVersion: version,
      links: omit(config.serverInfo, ["name"]),
    },
  }));
};

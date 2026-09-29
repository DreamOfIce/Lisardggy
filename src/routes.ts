import type { FastifyInstance } from "fastify";

import type { YggdrasilServerConfig } from "./config";
import { authServer, metadataServer, sessionServer } from "./libs";

export const registerRoutes = (fastify: FastifyInstance, config: YggdrasilServerConfig) => {
  fastify.register(authServer, config);
  fastify.register(sessionServer, config);
  fastify.register(metadataServer, config);
};

import fastifyReplyFrom from "@fastify/reply-from";
import type { FastifyPluginAsync } from "fastify";

import type { YggdrasilServerConfig } from "../config";
import type { FastifyInstance } from "../utils";

export const minecraftservicesServer: FastifyPluginAsync<YggdrasilServerConfig> = async (
  fastify,
  config,
) => {
  const logger = fastify.log.child({}, { msgPrefix: "[minecraftServices] " });

  fastify.register(fastifyReplyFrom, {
    base: config.fallback.minecraftServices,
    disableCache: true,
    retryMethods: [],
    undici: config.fallback.proxy
      ? {
          proxy: config.fallback.proxy,
        }
      : {},
  });
  fastify.register(
    (fastify: FastifyInstance) => {
      fastify.alias("POST", "/minecraft/profile/lookup/bulk/byname", `/api/profiles/minecraft`);
      fastify.alias(
        "GET",
        "/minecraft/profile/lookup/name/:name",
        "/api/users/profiles/minecraft/:name",
      );
      fastify.route({
        method: ["GET", "HEAD", "POST", "PUT", "PATCH", "OPTIONS", "DELETE"],
        url: "/*",
        handler: async (req, reply) => {
          logger.debug("Forward request to %s%s", config.fallback.minecraftServices, req.url);
          return reply.from(req.url);
        },
      });
    },
    { prefix: "/minecraftservices" },
  );
};

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
          const url = req.url.slice(18); // remove '/minecraftservices'
          logger.debug("Forward request to %s%s", config.fallback.minecraftServices, url);
          return reply.from(url);
        },
      });
    },
    { prefix: "/minecraftservices" },
  );
};

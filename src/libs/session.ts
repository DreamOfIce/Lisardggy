import type { FastifyPluginAsync } from "fastify";

import type { YggdrasilServerConfig } from "../config";

export const sessionServer: FastifyPluginAsync<YggdrasilServerConfig> = async (fastify, config) => {
  fastify.register(
    async (fastify) => {
      fastify.post("/session/minecraft/join", () => {});
    },
    { prefix: "/sessionserver" },
  );
};

import type { FastifyPluginAsync } from "fastify";

export interface SessionServerOptions {
  passThrough: boolean;
  officalServerURL: string;
}

export const sessionServer: FastifyPluginAsync<SessionServerOptions> = async (fastify, options) => {
  fastify.register(
    async (fastify) => {
      fastify.post("/session/minecraft/join", () => {});
    },
    { prefix: "/sessionserver" },
  );
};

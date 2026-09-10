import type { FastifyInstance } from "fastify";

export interface sessionServerOptions {
  passThrough: boolean;
  officalServerURL: string;
}

export const sessionServer = (fastify: FastifyInstance, options: sessionServerOptions) => {
  fastify.post("/session/minecraft/join", () => {});
};

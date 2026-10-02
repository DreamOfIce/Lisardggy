import { type Dict } from "cosmokit";
import type { FastifyInstance, FastifyPluginAsync, HTTPMethods, RouteOptions } from "fastify";
import fp from "fastify-plugin";

declare module "fastify" {
  export interface FastifyInstance {
    alias(method: HTTPMethods | HTTPMethods[], path: string, target: string): void;
  }
}
const routes: Dict<Dict<RouteOptions>> = {};

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRoute", (options) => {
    const methods = Array.isArray(options.method) ? options.method : [options.method];
    routes[options.url] ??= {};
    methods.forEach((method) => {
      routes[options.url]![method.toUpperCase()] = options;
    });
  });
  function alias(
    this: FastifyInstance,
    method: HTTPMethods | HTTPMethods[],
    path: string,
    target: string,
  ) {
    const methods = Array.isArray(method) ? method : [method];
    methods.forEach((m) => {
      const method = m.toUpperCase();
      if (routes[target]?.[method]) {
        this.route({ ...routes[target][method], url: path });
      }
    });
  }
  fastify.decorate("alias", alias);
};

export const aliasPlugin = fp(plugin, {
  name: "@yggdrasil-server/alias",
});

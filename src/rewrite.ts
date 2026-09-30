import type { IncomingMessage } from "node:http";

import { Dict } from "cosmokit";

import type { FastifyInstance } from "./utils";

const rewrites: Dict<string> = {};

export function rewriteUrl(this: FastifyInstance, req: IncomingMessage): string {
  if (req.url !== undefined && Reflect.has(rewrites, req.url)) {
    this.log.trace(`rewrite ${req.url} to ${rewrites[req.url]!}`);
    return rewrites[req.url]!;
  } else {
    return req.url!;
  }
}

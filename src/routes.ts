import { omit } from "cosmokit";
import type { FastifyPluginAsync } from "fastify";

import { name, version } from "../package.json";
import type { YggdrasilServerConfig } from "./config";
import { apiServer, authServer, minecraftservicesServer, sessionServer } from "./libs";
import { API } from "./schemas";
import { Keys } from "./utils";

export const routes: FastifyPluginAsync<YggdrasilServerConfig> = async (fastify, config) => {
  const { publicKey, privateKey } = await Keys.loadKeys(
    config.signature,
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 4096,
      publicExponent: Uint8Array.from([0x01, 0x00, 0x01]),
      hash: "SHA-1",
    },
    fastify.log,
  );

  fastify.register(apiServer, config);
  fastify.register(authServer, config);
  fastify.register(minecraftservicesServer, config);
  fastify.register(sessionServer, Object.assign({}, config, { signingKey: privateKey }));

  const metadata: API.MetaData.Response = {
    meta: {
      serverName: config.metadata.name,
      implementationName: name,
      implementationVersion: version,
      links: omit(config.metadata, ["name"]),
    },
    signaturePublickey: await Keys.exportPEM(publicKey),
  };
  fastify.get("/", { schema: { response: { 200: API.MetaData.Response } } }, async () => metadata);
};

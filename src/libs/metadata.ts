import { omit } from "cosmokit";
import type { FastifyPluginAsync } from "fastify";

import { name, version } from "../../package.json";
import type { YggdrasilServerConfig } from "../config";
import { API } from "../schemas";
import { Keys, type FastifyInstance } from "../utils";

export const metadataServer: FastifyPluginAsync<YggdrasilServerConfig> = async (
  fastify: FastifyInstance,
  config,
) => {
  const { publicKey } = await Keys.loadKeys(
    config.signature,
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 4096,
      publicExponent: Uint8Array.from([0x01, 0x00, 0x01]),
      hash: "SHA-1",
    },
    fastify.log,
  );
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

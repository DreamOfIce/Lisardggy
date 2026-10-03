import { omit } from "cosmokit";
import type { FastifyPluginAsync } from "fastify";

import { name, version } from "../package.json";
import type { LisardggyConfig } from "./config";
import {
  apiServer,
  authServer,
  minecraftservicesServer,
  sessionServer,
  skinServer,
} from "./routes";
import { API } from "./schemas";
import { type FastifyInstance, Keys } from "./utils";

export const routes: FastifyPluginAsync<LisardggyConfig> = async (
  fastify: FastifyInstance,
  config,
) => {
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
  fastify.register(skinServer, config);

  const links = omit(config.metadata, ["name"]);
  const pubKey = await Keys.exportPEM(publicKey);
  const skinDomains = config.fallback.passThrough ? [".minecraft.net", ".mojang.com"] : [];

  fastify.get("/", { schema: { response: { 200: API.MetaData.Response } } }, async (req, reply) => {
    reply.code(200).send({
      meta: {
        serverName: config.metadata.name,
        implementationName: name,
        implementationVersion: version,
        links,
        "feature.non_email_login": true,
        "feature.legacy_skin_api": true,
        "feature.no_mojang_namespace": config.fallback.passThrough,
        "feature.enable_mojang_anti_features": false,
        "feature.enable_profile_key": false,
      },
      skinDomains: [...skinDomains, new URL(config.skin.baseUrl, `https://${req.host}`).host],
      signaturePublickey: pubKey,
    });
  });
};

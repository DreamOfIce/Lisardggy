import { mkdir } from "node:fs/promises";

import fastifyReplyFrom from "@fastify/reply-from";
import fastifyStatic from "@fastify/static";
import type { FastifyPluginAsync } from "fastify";
import { request } from "undici";

import type { YggdrasilServerConfig } from "../config";
import { API, Textures } from "../schemas";
import type { FastifyInstance } from "../utils";

export const skinServer: FastifyPluginAsync<YggdrasilServerConfig> = async (fastify, config) => {
  const logger = fastify.log.child({}, { msgPrefix: "[skin] " });
  await mkdir(config.skin.savePath, { recursive: true });

  if (config.fallback.passThrough)
    fastify.register(fastifyReplyFrom, {
      disableCache: true,
      retryMethods: [],
      undici: config.fallback.proxy
        ? {
            proxy: config.fallback.proxy,
          }
        : {},
    });

  fastify.register(fastifyStatic, {
    root: config.skin.savePath,
    prefix: "/textures/",
    extensions: ["png"],
    immutable: true,
    maxAge: "1y",
    setHeaders: (reply) => {
      reply.header("content-type", "image/png");
    },
  });

  fastify.register((fastify: FastifyInstance) => {
    fastify.get(
      "/skins/MinecraftSkins/:name",
      { schema: { params: API.Skin.MinecraftSkins.Params } },
      async (req, reply) => {
        const { name } = req.params;
        const profile = fastify.database.queryProfileByName(name);
        if (config.fallback.passThrough && !profile) {
          try {
            let { body } = await request(
              new URL(`/users/profiles/minecraft/${name}`, config.fallback.apiServer),
            );
            const { id } = API.APIServer.ProfileByName.Response(
              <API.Session.Profile.Response>await body.json(),
            );
            ({ body } = await request(
              new URL(`/session/minecraft/profile/${id}`, config.fallback.sessionServer),
            ));
            const { properties } = API.Session.Profile.Response(
              <API.Session.Profile.Response>await body.json(),
            );
            console.log(properties);
            const textures = Textures(
              <Textures>(
                JSON.parse(
                  atob(properties.find(({ name: propName }) => propName === "textures")!.value),
                )
              ),
            );
            if (textures.textures["SKIN"]?.url)
              return await reply.from(textures.textures["SKIN"].url);
            else throw new Error("texture 'SKIN' not found");
          } catch (err) {
            console.error(err);
            logger.error("Failed to get skin info from upstream server: %o", err!);
            return reply.code(404).send();
          }
        }
        const { hash } = profile?.skin.textures["skin"] ?? {};
        if (!hash) return reply.code(404).send();
        logger.trace("skin hash of profile %s is: %s", name, hash);
        return reply
          .header("content-type", "image/png")
          .sendFile(`${hash.toLowerCase()}.png`, { immutable: true, maxAge: "1y" });
      },
    );
  });
};

import fastifyMultipart from "@fastify/multipart";
import fastifyReplyFrom from "@fastify/reply-from";
import type { FastifyPluginAsync } from "fastify";
import { request } from "undici";

import type { YggdrasilServerConfig } from "../config";
import { YggdrasilErrors, YggdrasilServerError } from "../error";
import { API, type ProfileBase } from "../schemas";
import { type FastifyInstance } from "../utils";

export const apiServer: FastifyPluginAsync<YggdrasilServerConfig> = async (fastify, config) => {
  const logger = fastify.log.child({}, { msgPrefix: "[api] " });

  fastify.register(
    (fastify: FastifyInstance) => {
      fastify.register(fastifyReplyFrom, {
        base: config.fallback.apiServer,
        disableCache: true,
        retryMethods: [],
        undici: config.fallback.proxy
          ? {
              proxy: config.fallback.proxy,
            }
          : {},
      });
      fastify.post(
        "/profiles/minecraft",
        {
          schema: {
            body: API.APIServer.Profiles.Body,
            response: { 200: API.APIServer.Profiles.Response },
          },
        },
        async (req, reply) => {
          const names = [...new Set(req.body)];
          const profiles: ProfileBase[] = fastify.database.data.profile.filter(({ name }) =>
            names.includes(name),
          );
          if (config.fallback.passThrough && profiles.length < names.length) {
            const localProfiles = profiles.map(({ name }) => name);
            const remoteProfiles = names.filter((name) => !localProfiles.includes(name));
            logger.trace(
              "profiles %s not found, try to fetch from upstream server",
              remoteProfiles.join(","),
            );
            try {
              const { body } = await request(
                new URL("/profiles/minecraft", config.fallback.apiServer),
                {
                  method: "POST",
                  body: JSON.stringify(remoteProfiles),
                  headers: { "Content-Type": "application/json;charset=utf-8" },
                },
              );
              profiles.push(...(<ProfileBase[]>await body.json()));
            } catch (err) {
              logger.warn("Failed to query profiles from upstream server: %o", err!);
            }
          }
          return reply.code(200).send(profiles);
        },
      );
      fastify.alias("POST", "/minecraft/profile/lookup/bulk/byname", "/api/profiles/minecraft");

      fastify.get(
        "/users/profiles/minecraft/:name",
        {
          schema: {
            params: API.APIServer.ProfileByName.Params,
            response: { 200: API.APIServer.ProfileByName.Response, 204: true },
          },
        },
        async (req, reply) => {
          const { name } = req.params;
          const profile = fastify.database.queryProfileByName(name);
          if (!profile) {
            if (config.fallback.passThrough) {
              const { body, statusCode } = await request(
                new URL(`/users/profiles/minecraft/${name}`, config.fallback.apiServer),
                {
                  method: "GET",
                  body: JSON.stringify(req.body),
                  headers: { "Content-Type": "application/json;charset=utf-8" },
                },
              );
              if (statusCode === 200) return reply.code(200).send(<ProfileBase>await body.json());
            }
            throw new YggdrasilServerError(`Couldn't find any profile with name ${name}`, {
              code: 404,
            });
          }
          return reply.code(200).send(profile);
        },
      );
      fastify.alias(
        "GET",
        "/minecraft/profile/lookup/name/:name",
        "/api/users/profiles/minecraft/:name",
      );

      fastify.route({
        method: ["GET", "HEAD", "POST", "PUT", "PATCH", "OPTIONS", "DELETE"],
        url: "/*",
        handler: async (req, reply) => {
          const url = req.url.slice(4); // remove prefix '/api'
          logger.debug("Forward request to %s%s", config.fallback.apiServer, url);
          return reply.from(url);
        },
      });
    },
    { prefix: "/api" },
  );

  fastify.register(
    async (fastify: FastifyInstance) => {
      fastify.register(fastifyMultipart, {
        attachFieldsToBody: "keyValues",
        limits: { fileSize: config.skin.maxFileSize },
      });
      fastify.put(
        "/user/profile/:id/:type",
        {
          schema: {
            headers: API.APIServer.UploadSkin.Headers,
            params: API.APIServer.UploadSkin.Params,
            body: API.APIServer.UploadSkin.Body,
          },
        },
        async (req, reply) => {
          const { authorization } = req.headers;
          const { id, type } = req.params;
          const token = authorization.trim().match(/^Bearer (.+)$/)?.[1];
          if (!token) throw new YggdrasilServerError(YggdrasilErrors.AuthInvalidToken);
          const { file, model } = req.body;
          await fastify.skin.set(id, type, file, { model });
          return reply.code(204).send();
        },
      );

      fastify.delete(
        "/user/profile/:id/:type",
        {
          schema: {
            headers: API.APIServer.DeleteSkin.Headers,
            params: API.APIServer.DeleteSkin.Params,
          },
        },
        async (req, reply) => {
          const { authorization } = req.headers;
          const { id, type } = req.params;
          const token = authorization.trim().match(/^Bearer (.+)$/)?.[1];
          if (!token) throw new YggdrasilServerError(YggdrasilErrors.AuthInvalidToken);
          fastify.jwt.verify(token, { pid: id });
          await fastify.skin.remove(id, type);
          return reply.code(204).send();
        },
      );
    },
    { prefix: "/api" },
  );
};

import fastifyReplyFrom from "@fastify/reply-from";
import type { Dict } from "cosmokit";
import type { FastifyPluginAsync } from "fastify";

import type { YggdrasilServerConfig } from "../config";
import { API } from "../schemas";
import { formatIP, Keys, profileData2Profile, signProfile, type FastifyInstance } from "../utils";

export interface SessionInfo {
  profile: string;
  clientAddr: string | undefined;
  timeout: ReturnType<typeof setTimeout>;
}

export const sessionServer: FastifyPluginAsync<YggdrasilServerConfig> = async (fastify, config) => {
  const logger = fastify.log.child({}, { msgPrefix: "[session] " });
  const sessions: Dict<SessionInfo> = {};
  const { privateKey } = await Keys.loadKeys(
    config.signature,
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 4096,
      publicExponent: Uint8Array.from([0x01, 0x00, 0x01]),
      hash: "SHA-1",
    },
    logger,
  );

  fastify.addHook("preClose", () => {
    Object.values(sessions).forEach(({ timeout }) => {
      clearTimeout(timeout);
    });
  });

  if (config.fallback.passThrough)
    fastify.register(fastifyReplyFrom, {
      base: config.fallback.sessionServer,
      disableCache: true,
      retryMethods: [],
      undici: config.fallback.proxy
        ? {
            proxy: config.fallback.proxy,
          }
        : {},
    });

  fastify.register(
    async (fastify: FastifyInstance) => {
      fastify.post(
        "/session/minecraft/join",
        {
          schema: {
            body: API.Session.Join.Body,
            response: { 200: API.Session.HasJoined.Response, 204: true },
          },
        },
        async (request, reply) => {
          const { accessToken, selectedProfile, serverId } = request.body;
          if (config.fallback.passThrough) {
            try {
              const { iss } = fastify.jwt.decode(accessToken);
              if (iss !== fastify.database.data.yggdrasil.instanceID) throw new Error();
            } catch {
              logger.debug("Access token decoding failed, forward to the fallback server");
              return reply.from("/session/minecraft/join");
            }
          }
          const { sub, profile } = fastify.jwt.verify(accessToken, { pid: selectedProfile });

          const timeout = setTimeout(() => Reflect.deleteProperty(sessions, serverId), 30_000);
          sessions[serverId] = {
            profile: selectedProfile,
            clientAddr: formatIP(request.ip),
            timeout,
          };

          logger.debug(`User ${sub} join games with profile ${profile.name!}(${selectedProfile})`);
          return reply.code(204).send();
        },
      );

      fastify.get(
        "/session/minecraft/hasJoined",
        {
          schema: {
            querystring: API.Session.HasJoined.QueryString,
            response: { 200: API.Session.HasJoined.Response, 204: true },
          },
        },
        async (request, reply) => {
          const { username, ip, serverId } = request.query;
          if (!Reflect.has(sessions, serverId)) {
            if (config.fallback.passThrough) {
              logger.debug("ServerId not found, forward to the fallback server");
              return reply.from("/session/minecraft/hasJoined", {
                queryString: { username, serverId }, // remove query 'ip'
              });
            } else {
              return reply.code(204).send();
            }
          }

          const { profile, clientAddr } = Reflect.get(sessions, serverId);
          if (ip && clientAddr !== formatIP(ip)) return reply.code(204).send();
          const p = fastify.database.queryProfile(profile);
          if (username === p?.name)
            return reply.status(200).send(await signProfile(profileData2Profile(p), privateKey));
        },
      );

      fastify.get(
        "/session/minecraft/profile/:uuid",
        {
          schema: {
            params: API.Session.Profile.Params,
            querystring: API.Session.Profile.QueryString,
            response: { 200: API.Session.Profile.Response, 204: true },
          },
        },
        async (request, reply) => {
          const { uuid } = request.params;
          const { unsigned } = request.query;
          const profile = fastify.database.queryProfile(uuid);
          if (!profile) {
            if (config.fallback.passThrough)
              return reply.from(`/session/minecraft/profile/${uuid}`);
            else return reply.code(204).send();
          } else if (unsigned) {
            return reply.code(200).send(profileData2Profile(profile));
          } else {
            return reply
              .code(200)
              .send(await signProfile(profileData2Profile(profile), privateKey));
          }
        },
      );
    },
    { prefix: "/sessionserver" },
  );
};

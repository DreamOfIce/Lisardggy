import fastifyReplyFrom from "@fastify/reply-from";
import type { Dict } from "cosmokit";
import type { FastifyPluginAsync } from "fastify";

import type { YggdrasilServerConfig } from "../config";
import { API } from "../schemas";
import { formatIP, profileData2Profile, signProfile, type FastifyInstance } from "../utils";

export interface SessionServerConfig extends YggdrasilServerConfig {
  signingKey: CryptoKey;
}

export interface SessionInfo {
  profile: string;
  clientAddr: string | undefined;
  timeout: ReturnType<typeof setTimeout>;
}

export const sessionServer: FastifyPluginAsync<SessionServerConfig> = async (fastify, config) => {
  const logger = fastify.log.child({}, { msgPrefix: "[session] " });
  const sessions: Dict<SessionInfo> = {};

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
            body: API.SessionServer.Join.Body,
            response: { 200: API.SessionServer.HasJoined.Response, 204: true },
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
          const clientAddr = formatIP(request.ip);
          sessions[serverId] = {
            profile: selectedProfile,
            clientAddr,
            timeout,
          };

          logger.trace("accessToken: %s", accessToken);
          logger.trace("clientAddr: %s", clientAddr);
          logger.trace("serverId: %s", serverId);
          logger.debug(`User ${sub} joins game with profile ${profile.name!}(${selectedProfile})`);

          return reply.code(204).send();
        },
      );

      fastify.get(
        "/session/minecraft/hasJoined",
        {
          schema: {
            querystring: API.SessionServer.HasJoined.QueryString,
            response: { 200: API.SessionServer.HasJoined.Response, 204: true },
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

          logger.trace("clientAddr: %s", clientAddr);
          logger.trace("serverId: %s", serverId);
          logger.trace("profile: %s", p?.id ?? "not found");

          if (username === p?.name)
            return reply
              .status(200)
              .send(await signProfile(profileData2Profile(p, config), config.signingKey));
          else return reply.code(204).send();
        },
      );

      fastify.get(
        "/session/minecraft/profile/:uuid",
        {
          schema: {
            params: API.SessionServer.Profile.Params,
            querystring: API.SessionServer.Profile.QueryString,
            response: { 200: API.SessionServer.Profile.Response, 204: true },
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
            return reply.code(200).send(profileData2Profile(profile, config));
          } else {
            return reply
              .code(200)
              .send(await signProfile(profileData2Profile(profile, config), config.signingKey));
          }
        },
      );
    },
    { prefix: "/sessionserver" },
  );
};

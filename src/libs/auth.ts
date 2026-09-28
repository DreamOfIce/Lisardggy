import fastifyRateLimit from "@fastify/rate-limit";
import type { Dict } from "cosmokit";
import type { FastifyPluginAsync } from "fastify";

import type { YggdrasilServerConfig } from "../config";
import { YggdrasilErrors, YggdrasilServerError } from "../error";
import { API, type Profile } from "../schemas";
import {
  Argon2,
  profileData2Profile,
  randomUUID,
  userData2User,
  type FastifyInstance,
} from "../utils";
import type { ProfileData } from "./database";

export const authServer: FastifyPluginAsync<YggdrasilServerConfig> = async (
  fastify: FastifyInstance,
  config,
) => {
  const logger = fastify.log.child({}, { msgPrefix: "[auth] " });
  fastify.register(fastifyRateLimit, {
    ban: 0, // always return 403
    errorResponseBuilder: () => new YggdrasilServerError(YggdrasilErrors.AuthInvalidCredential),
    global: false,
    hook: "preHandler",
    keyGenerator: (req) => (req.body as Dict<string>)["username"]!,
    max: config.auth.rateLimit.max,
    timeWindow: config.auth.rateLimit.timeWindow,
  });

  fastify.register(
    async (fastify: FastifyInstance) => {
      fastify.post(
        "/authenticate",
        {
          config: {
            rateLimit: {
              groupId: "authenticate",
            },
          },
          schema: {
            body: API.AuthServer.Authenticate.Body,
            response: { 200: API.AuthServer.Authenticate.Response },
          },
        },
        async (request, reply) => {
          const { username, password, clientToken = randomUUID(), requestUser } = request.body;
          const user = fastify.database.queryUser(username);
          if (!user || !(await Argon2.verify(password, user.hashedPwd))) {
            throw new YggdrasilServerError(YggdrasilErrors.AuthInvalidCredential);
          }
          if (!Argon2.compareOptions(password, config)) {
            user.hashedPwd = await Argon2.hash(password, config);
            await fastify.database.write();
          }
          const availableProfiles = user.profiles.map((id) => {
            const p = fastify.database.queryProfile(id);
            if (p === undefined) throw new YggdrasilServerError(`Failed to query profile ${id}`);
            return profileData2Profile(p);
          });
          let selectedProfile: Profile | undefined;
          if (availableProfiles.length === 1) selectedProfile = availableProfiles[0];
          else if (!username.includes("@"))
            selectedProfile = availableProfiles.find(({ name }) => name === username);
          const accessToken = await fastify.jwt.sign({
            clientToken,
            selectedProfile,
            uid: user.id,
          });

          logger.debug(`User ${user.id} logs in`);
          logger.trace("client token: %s", clientToken);
          logger.trace("access token: %s", accessToken);
          logger.trace("selected profile: %s", selectedProfile?.id ?? "none");

          const res: API.AuthServer.Authenticate.Response = {
            accessToken,
            clientToken,
            availableProfiles,
          };
          if (selectedProfile) res.selectedProfile = selectedProfile;
          if (requestUser) res.user = userData2User(user);
          return reply.code(200).send(res);
        },
      );

      fastify.post(
        "/refresh",
        {
          schema: {
            body: API.AuthServer.Refresh.Body,
            response: { 200: API.AuthServer.Refresh.Response },
          },
        },
        async (request, reply) => {
          const { accessToken, clientToken, requestUser, selectedProfile } = request.body;
          const {
            ctk,
            profile,
            sub: uid,
          } = fastify.jwt.verify(accessToken, { clientToken, allowOutdated: true });
          if (selectedProfile && profile.id && selectedProfile.id !== profile.id)
            throw new YggdrasilServerError(YggdrasilErrors.AssignInvalidToken);
          let newProfile: ProfileData | undefined;
          if (selectedProfile || profile.id) {
            const id = selectedProfile?.id ?? profile.id!;
            newProfile = fastify.database.queryProfile(id);
            if (!newProfile)
              throw new YggdrasilServerError(`Profile ${id} not found.`, {
                code: 400,
              });
            if (newProfile.uid !== uid)
              throw new YggdrasilServerError(YggdrasilErrors.AssignInvalidProfile);
          }

          const res: API.AuthServer.Refresh.Response = {
            clientToken: ctk,
            accessToken: await fastify.jwt.sign({
              clientToken: ctk,
              selectedProfile: newProfile,
              uid,
            }),
          };
          if (newProfile) res.selectedProfile = profileData2Profile(newProfile);
          if (requestUser) res.user = userData2User(fastify.database.queryUserByID(uid)!);

          logger.trace("client token: %s", res.clientToken);
          logger.trace("new access token: %s", res.accessToken);
          logger.trace("selected profile: %s", selectedProfile?.id ?? "none");

          await fastify.jwt.invalidate(accessToken);
          return reply.status(200).send(res);
        },
      );

      fastify.post(
        "/validate",
        {
          schema: {
            body: API.AuthServer.Validate.Body,
          },
        },
        async (request, reply) => {
          const { accessToken, clientToken } = request.body;
          fastify.jwt.verify(accessToken, { clientToken });
          return reply.code(204).send();
        },
      );

      fastify.post(
        "/invalidate",
        {
          schema: {
            body: API.AuthServer.Invalidate.Body,
          },
        },
        async (request, reply) => {
          const { accessToken } = request.body;
          fastify.jwt.verify(accessToken);
          try {
            await fastify.jwt.invalidate(accessToken);
          } catch {
            /* void */
          }
          return reply.code(204).send();
        },
      );
      fastify.post(
        "/signout",
        {
          config: {
            rateLimit: {
              groupId: "authenticate",
            },
          },
          schema: {
            body: API.AuthServer.SignOut.Body,
          },
        },
        async (request, reply) => {
          const { username, password } = request.body;
          const user = fastify.database.queryUser(username);
          if (!user || !(await Argon2.verify(password, user.hashedPwd))) {
            throw new YggdrasilServerError(YggdrasilErrors.AuthInvalidCredential);
          }

          if (!Argon2.compareOptions(password, config)) {
            user.hashedPwd = await Argon2.hash(password, config);
          }
          user.minSeq = user.tokenSeq;
          await fastify.database.write();

          logger.debug(`User ${user.id} signs out`);
          return reply.code(204).send();
        },
      );
    },
    { prefix: "/authserver" },
  );
};

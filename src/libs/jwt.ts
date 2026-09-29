import { webcrypto } from "node:crypto";

import { pick } from "cosmokit";
import { type Bufferable, createDecoder, createSigner, createVerifier } from "fast-jwt";
import { type FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

import type { YggdrasilServerConfig } from "../config";
import { YggdrasilServerError, YggdrasilErrors } from "../error";
import { Keys } from "../utils";

declare module "fastify" {
  interface FastifyInstance {
    jwt: {
      decode(token: Bufferable): YggdrasilAccessTokenData;
      invalidate(token: Bufferable): Promise<void>;
      sign(options: JWTSignOptions): Promise<string>;
      verify(token: Bufferable, options?: JWTVerifyOptions): YggdrasilAccessTokenData;
    };
  }
}

export interface YggdrasilAccessTokenData {
  ctk: string; // client token
  exp: number;
  iat: number;
  iss: string;
  jti: string;
  odt: number; // outdated at
  profile: {
    id?: string;
    name?: string;
  }; // profile
  seq: number; // sequence id
  sub: string; // uid
}

export interface JWTSignOptions {
  clientToken: string;
  uid: string;
  selectedProfile?: { id: string; name: string } | undefined;
}
export interface JWTVerifyOptions {
  clientToken?: string | undefined;
  pid?: string | undefined;
  uid?: string | undefined;
  allowOutdated?: boolean;
}

const plugin: FastifyPluginAsync<YggdrasilServerConfig> = async (instance, { auth }) => {
  const options = auth.jwt;
  const logger = instance.log.child({}, { msgPrefix: "[JWT] " });
  let publicKey: CryptoKey, privateKey: CryptoKey;
  try {
    ({ publicKey, privateKey } = await Keys.loadKeys(options, "Ed25519", logger));
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
  const interval = setInterval(() => {
    const now = Date.now() / 1000;
    void instance.database.update(({ revocationList }) => {
      Object.entries(revocationList).forEach(([jti, exp]) => {
        if (exp < now) Reflect.deleteProperty(revocationList, jti);
      });
    });
  }, options.revocationListGCInterval * 1000);
  instance.addHook("onClose", () => {
    clearInterval(interval);
  });

  const decoder = createDecoder();
  const signer = createSigner({
    key: await Keys.exportPEM(privateKey),
    iss: instance.database.data.yggdrasil.instanceID,
  });
  const verifier = createVerifier({
    key: await Keys.exportPEM(publicKey),
    allowedIss: instance.database.data.yggdrasil.instanceID,
  });
  const jwt = {
    decode(token: Bufferable) {
      return decoder(token) as YggdrasilAccessTokenData;
    },
    async invalidate(token: Bufferable) {
      const { exp, jti } = this.decode(token);
      instance.database.data.revocationList[jti] = exp;
      await instance.database.write();
      logger.debug(`revoke token ${jti}`);
    },
    async sign({ clientToken, selectedProfile, uid }: JWTSignOptions) {
      const user = instance.database.queryUserByID(uid);
      if (!user) throw new YggdrasilServerError(`User does not exist`);
      const now = Math.floor(Date.now() / 1000);
      const token = signer({
        ctk: clientToken,
        exp: now + options.expires,
        jti: webcrypto.randomUUID(),
        odt: now + options.outdate,
        profile: selectedProfile ? pick(selectedProfile, ["id", "name"]) : {},
        seq: user.tokenSeq++,
        sub: uid,
      });
      await instance.database.write();
      return token;
    },
    verify(
      token: Bufferable,
      { clientToken, pid, uid, allowOutdated = false }: JWTVerifyOptions = {},
    ) {
      let decoded: YggdrasilAccessTokenData;
      try {
        decoded = verifier(token) as YggdrasilAccessTokenData;
      } catch (err) {
        logger.debug(`Verification failed: %s`, err instanceof Error ? err.message : err);
        throw new YggdrasilServerError(YggdrasilErrors.AuthInvalidToken);
      }
      const { ctk, jti, odt, profile, seq, sub } = decoded;
      if (Reflect.has(instance.database.data.revocationList, jti)) {
        logger.debug("Verification failed: token has been revoked");
        throw new YggdrasilServerError(YggdrasilErrors.AuthInvalidToken);
      }
      if (clientToken && ctk !== clientToken) {
        logger.debug("Verification failed: client token mismatch");
        throw new YggdrasilServerError(YggdrasilErrors.AuthInvalidToken);
      }
      if (uid !== undefined && sub !== uid) {
        logger.debug("Verification failed: user id mismatch");
        throw new YggdrasilServerError(YggdrasilErrors.AuthInvalidToken);
      }
      if (pid !== undefined && profile.id !== pid) {
        logger.debug("Verification failed: profile id mismatch");
        throw new YggdrasilServerError(YggdrasilErrors.AuthInvalidToken);
      }
      const user = instance.database.queryUserByID(sub);
      if (!user) {
        logger.debug(`Verification failed: user ${sub} does not exist`);
        throw new YggdrasilServerError(YggdrasilErrors.AuthInvalidToken);
      }
      if (seq < user.minSeq) {
        logger.debug("Verification failed: token has been revoked(user signed out)");
        throw new YggdrasilServerError(YggdrasilErrors.AuthInvalidToken);
      }
      if (seq < user.tokenSeq - options.maxTokens) {
        logger.debug("Verification failed: token has been revoked(exceed max limit)");
        throw new YggdrasilServerError(YggdrasilErrors.AuthInvalidToken);
      }
      if (!allowOutdated && odt < Date.now() / 1000) {
        logger.debug("Verification failed: token outdated");
        throw new YggdrasilServerError(YggdrasilErrors.AuthInvalidToken);
      }
      if (profile.id) {
        const p = instance.database.queryProfile(profile.id);
        if (!p) {
          logger.debug(`Verification failed: profile ${profile.id} not found`);
          throw new YggdrasilServerError("Profile not found.", {
            code: 400,
          });
        }
        if (uid !== undefined && p.uid !== uid) {
          logger.debug(`Verification failed: profile ${p.id} does not belong to ${uid}`);
          throw new YggdrasilServerError(YggdrasilErrors.AuthInvalidToken);
        }
        if (!allowOutdated && profile.name !== p.name) {
          logger.debug("Verification failed: token outdated(profile name changed)");
          throw new YggdrasilServerError(YggdrasilErrors.AuthInvalidToken);
        }
      }
      return decoded;
    },
  };
  instance.decorate("jwt", jwt);
};

export const jwtPlugin = fp(plugin);

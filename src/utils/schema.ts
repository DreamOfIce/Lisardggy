import { webcrypto } from "node:crypto";

import { Binary } from "cosmokit";

import type { YggdrasilServerConfig } from "../config";
import type { ProfileData, UserData } from "../plugins";
import type { Profile, ProfileWithSignature, User } from "../schemas";

export const profileData2Profile = (
  profile: ProfileData,
  config: YggdrasilServerConfig,
): Profile => {
  const { id, name, extProps, skin } = profile;
  const textures = {
    timestamp: skin.lastUpdate,
    profileId: id,
    profileName: name,
    textures: Object.fromEntries(
      Object.entries(skin.textures)
        .filter(([key]) => ["skin", "cape"].includes(key))
        .map(([key, { hash, metadata }]) => [
          key.toUpperCase(),
          { url: `${config.skin.baseUrl}${hash}`, metadata },
        ]),
    ),
  };
  const encodedTextures = btoa(JSON.stringify(textures));
  const uploadableTextures = skin.uploadable.join(",");
  const properties = Object.entries({
    ...extProps,
    textures: encodedTextures,
    uploadableTextures,
  }).map(([name, value]) => ({ name, value }));
  return { id, name, properties };
};

export const signProfile = async (
  profile: Profile,
  key: CryptoKey,
): Promise<ProfileWithSignature> => {
  const properties = await Promise.all(
    profile.properties.map(async ({ name, value }) => ({
      name,
      value,
      signature: Binary.toBase64(
        await webcrypto.subtle.sign(
          key.algorithm,
          key,
          Uint8Array.from(value, (c) => c.charCodeAt(0)),
        ),
      ),
    })),
  );
  return { ...profile, properties };
};

export const userData2User = (user: UserData): User => ({
  id: user.id,
  properties: Object.entries(user.props).map(([name, value]) => ({
    name,
    value,
  })),
});

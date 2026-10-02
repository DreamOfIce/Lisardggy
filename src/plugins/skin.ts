import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { FastifyBaseLogger, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import sharp from "sharp";

import type { YggdrasilServerConfig } from "../config";
import { YggdrasilServerError } from "../error";
import type { TextureType } from "../schemas";
import { SHA256 } from "../utils";
import type { Database } from "./database";

declare module "fastify" {
  export interface FastifyInstance {
    skin: SkinManager;
  }
}

export interface SkinManager {
  set(
    id: string,
    type: TextureType,
    image: Buffer<ArrayBuffer>,
    metadata: Record<string, string>,
  ): Promise<void>;
  remove(id: string, type: TextureType): Promise<void>;
}

export const createSkinManager = async (
  config: YggdrasilServerConfig,
  { database, logger }: { database: Database; logger: FastifyBaseLogger },
): Promise<SkinManager> => {
  await mkdir(config.skin.savePath, { recursive: true });
  const fileList = (await readdir(config.skin.savePath)).filter((path) => path.endsWith(".png"));
  const skins: Record<string, string[]> = Object.fromEntries(
    fileList.map((path) => [path.slice(0, -4), []]),
  );
  database.data.profile.forEach((profile) => {
    Object.entries(profile.skin.textures).forEach(([type, { hash }]) => {
      if (skins[hash]) skins[hash].push(`${profile.id}:${type}`);
      else logger.warn("%s file of %s not found: %s.png", type, profile.id, hash);
    });
  });

  const skinManager: SkinManager = {
    async set(id, type, image, metadata) {
      const profile = database.queryProfile(id);
      if (!profile) return;
      else if (!profile.skin.uploadable.includes(type))
        throw new YggdrasilServerError(`Texture ${type} is not uploadable`, { code: 403 });

      let hash = await SHA256.hash(image.buffer);
      if (skins[hash]) {
        skins[hash]!.push(`${id}:${type}`);
      } else {
        let img = sharp(image, {
          limitInputPixels: config.skin.maxWidth[type] ** 2,
        });
        const metadata = await img.metadata();
        switch (type) {
          case "cape": {
            // should be a multiple of 64*32 or 22*17
            if (metadata.width <= config.skin.maxWidth.skin) {
              if (
                metadata.width % 64 === 0 &&
                metadata.height % 32 === 0 &&
                metadata.width / metadata.height === 2
              ) {
                break;
              } else if (
                metadata.width % 22 === 0 &&
                metadata.height % 17 === 0 &&
                metadata.width / 22 === metadata.height / 17
              ) {
                const multiple = metadata.width / 22;
                img = sharp({
                  create: {
                    width: 64 * multiple,
                    height: 32 * multiple,
                    background: { r: 0, g: 0, b: 0, alpha: 0 },
                    channels: 4,
                  },
                }).composite([
                  { input: await img.toBuffer(), blend: "over", gravity: "northwest" },
                ]); // pad to the multiple of 64*32
                break;
              }
            }
            throw new YggdrasilServerError(`Image size is invalid.`, { code: 400 });
          }
          case "skin": {
            // should be a multiple of 64*64 or 64*32
            if (
              metadata.width % 64 === 0 &&
              metadata.height % 32 === 0 &&
              metadata.width <= config.skin.maxWidth.skin &&
              [1, 2].includes(metadata.width / metadata.height)
            )
              break;
            else throw new YggdrasilServerError(`Image size is invalid.`, { code: 400 });
          }
        }
        const output = await img.png({ force: true }).toBuffer();
        hash = await SHA256.hash(output.buffer);
        await writeFile(join(config.skin.savePath, `${hash}.png`), output);
        logger.debug("texture has been saved to %s.png", hash);
      }
      await this.remove(id, type);
      profile.skin.lastUpdate = Math.floor(Date.now() / 1000);
      profile.skin.textures[type] = { hash, metadata };
      logger.debug("Set %s of profile %s to %s.png", type, id, hash);
    },
    async remove(id, type) {
      const profile = database.queryProfile(id);
      if (!profile) return;
      else if (!profile.skin.uploadable.includes(type))
        throw new YggdrasilServerError(`Texture ${type} is not uploadable`, { code: 403 });
      else if (!Reflect.has(profile.skin.textures, type)) return;

      const { hash } = profile.skin.textures[type]!;
      profile.skin.lastUpdate = Math.floor(Date.now() / 1000);
      Reflect.deleteProperty(profile.skin.textures, type);
      await database.write();

      if (skins[hash]) skins[hash] = skins[hash].filter((s) => s !== `${id}:${type}`);
      logger.debug("Unset %s of profile %s", type, id);
      if (skins[hash]?.length === 0) {
        Reflect.deleteProperty(skins, hash);
        await rm(join(config.skin.savePath, `${hash}.png`));
        logger.debug("Remove unuse skin file: %s.png", hash);
      }
    },
  };
  return skinManager;
};

const plugin: FastifyPluginAsync<YggdrasilServerConfig> = async (instance, config) => {
  const logger = instance.log.child({}, { msgPrefix: "[skin] " });
  instance.decorate(
    "skin",
    await createSkinManager(config, { database: instance.database, logger }),
  );
};

export const skinPlugin = fp(plugin, {
  name: "@yggdrasil-server/skin",
  dependencies: ["@yggdrasil-server/database"],
});

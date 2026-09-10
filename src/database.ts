import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import type { Low } from "lowdb";
import { JSONFilePreset } from "lowdb/node";

declare module "fastify" {
  interface FastifyInstance {
    database: Low<DatabaseStructure>;
  }
}

export const DATABASE_VERSION = 1;

export interface YggdrasilInternalData {
  version: number;
}

export interface UserData {
  username: string;
  password: string;
  email: string;
  uuid: string;
  textures: {
    skin?: string;
    cape?: string;
  };
}

export interface DatabaseStructure {
  user: UserData[];
  yggdrasil: YggdrasilInternalData;
}

const defaultData: DatabaseStructure = {
  user: [],
  yggdrasil: {
    version: DATABASE_VERSION,
  },
};

export interface DatabasePluginOptions {
  path: string;
}

export const databasePlugin = fp(
  async (fastify: FastifyInstance, { path }: DatabasePluginOptions) => {
    fastify.decorate("database", await JSONFilePreset(path, defaultData));
  },
);

import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { defineProperty, type Dict } from "cosmokit";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import type { Low } from "lowdb";
import { JSONFilePreset } from "lowdb/node";

import { name } from "../../package.json";
import type { YggdrasilServerConfig } from "../config";
import { TextureType } from "../schemas";
import { randomUUID } from "../utils";

declare module "fastify" {
  interface FastifyInstance {
    database: Database;
  }
}

export interface Database extends Low<DatabaseStructure> {
  queryProfile: (this: Database, id: string) => ProfileData | undefined;
  queryProfileByName: (this: Database, name: string) => ProfileData | undefined;
  queryUser: (this: Database, id: string) => UserData | undefined;
  queryUserByName: (this: Database, username: string) => UserData | undefined;
}

export const DATABASE_VERSION = 1;

export interface YggdrasilInternalData {
  instanceID: string;
  version: number;
}

export interface UserData {
  id: string;
  email: string;
  hashedPwd: string;
  profiles: string[];
  props: Dict<string>;
  tokenSeq: number;
  minSeq: number;
}

export interface ProfileData {
  id: string;
  name: string;
  uid: string;
  extProps: Dict<string>;
  skin: {
    lastUpdate: number;
    uploadable: string[];
    textures: Partial<Dict<{ hash: string; metadata: Dict<string> }, TextureType>>;
  };
}

export interface DatabaseStructure {
  user: UserData[];
  profile: ProfileData[];
  revocationList: Dict<number>;
  yggdrasil: YggdrasilInternalData;
}

const defaultData: DatabaseStructure = {
  user: [],
  profile: [],
  revocationList: {},
  yggdrasil: {
    instanceID: `${name}.${randomUUID()}`,
    version: DATABASE_VERSION,
  },
};

const databaseHelpers: Partial<Database> = {
  queryProfile(_id) {
    return this.data.profile.find(({ id }) => id === _id);
  },
  queryProfileByName(_name) {
    return this.data.profile.find(({ name }) => name === _name);
  },
  queryUser(_id) {
    return this.data.user.find(({ id }) => id === _id);
  },
  queryUserByName(username) {
    if (username.includes("@")) return this.data.user.find(({ email }) => email === username);
    const profile = Object.values(this.data.profile).find(({ name }) => name === username);
    if (!profile) return;
    return this.data.user.find(({ id }) => id === profile.uid);
  },
};

export const createDatabase = async (config: YggdrasilServerConfig): Promise<Database> => {
  await mkdir(dirname(config.database.path), { recursive: true });
  const db = await JSONFilePreset(config.database.path, defaultData);
  await db.write();
  Object.entries(databaseHelpers).forEach(([method, func]) => defineProperty(db, method, func));
  return db as Database;
};

const plugin: FastifyPluginAsync<YggdrasilServerConfig> = async (instance, config) => {
  const db = await createDatabase(config);
  instance.decorate("database", db);
  instance.addHook("onClose", () => db.write());
};

export const databasePlugin = fp(plugin, {
  name: "@yggdrasil-server/database",
});

import Schema from "schemastery";

import { Profile as ProfileType, ProfileWithSignature } from "../profile";

export namespace SessionServer {
  export namespace Join {
    export interface Body {
      accessToken: string;
      selectedProfile: string;
      serverId: string;
    }
    export const Body: Schema<Body> = Schema.object({
      accessToken: Schema.string().required(),
      selectedProfile: Schema.string().required(),
      serverId: Schema.string().required(),
    });
  }
  export namespace HasJoined {
    export interface QueryString {
      username: string;
      ip?: string;
      serverId: string;
    }
    export const QueryString: Schema<QueryString> = Schema.object({
      username: Schema.string().required(),
      ip: Schema.string(),
      serverId: Schema.string().required(),
    });

    export type Response = ProfileWithSignature;
    export const Response = ProfileWithSignature;
  }
  export namespace Profile {
    export interface Params {
      uuid: string;
    }
    export const Params: Schema<Params> = Schema.object({
      uuid: Schema.string()
        .pattern(/[A-Fa-f0-9]{32}/)
        .min(32)
        .max(32)
        .required(),
    });

    export interface QueryString {
      unsigned: boolean;
    }
    export const QueryString: Schema<QueryString> = Schema.object({
      unsigned: Schema.boolean().default(true),
    });

    export type Response = ProfileType | ProfileWithSignature;
    export const Response = Schema.union([ProfileWithSignature, ProfileType]);
  }
}

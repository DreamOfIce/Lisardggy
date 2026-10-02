import type { InferType } from "fastify-type-provider-schemastery";
import Schema from "schemastery";

import { ProfileBase } from "../profile";
import { TextureType } from "../texture";

export namespace APIServer {
  export namespace Profiles {
    export type Body = InferType<typeof Body>;
    export const Body = Schema.array(Schema.string()).min(1).max(10).required();

    export type Response = InferType<typeof Response>;
    export const Response = Schema.array(ProfileBase);
  }

  export namespace ProfileByName {
    export interface Params {
      name: string;
    }
    export const Params: Schema<Params> = Schema.object({
      name: Schema.string().required(),
    });

    export type Response = ProfileBase;
    export const Response = ProfileBase;
  }

  export namespace UploadSkin {
    export type Headers = InferType<typeof Headers>;
    export const Headers = Schema.object({
      authorization: Schema.string().required(),
    });
    export type Params = InferType<typeof Params>;
    export const Params = Schema.object({
      id: Schema.string().required(),
      type: Schema(TextureType).required(),
    });

    export type Body = InferType<typeof Body>;
    export const Body = Schema.object({
      file: Schema.object({} as Buffer).required(),
      model: Schema.string().required(),
    });
  }
  export namespace DeleteSkin {
    export type Headers = InferType<typeof Headers>;
    export const Headers = Schema.object({
      authorization: Schema.string().required(),
    });
    export type Params = InferType<typeof Params>;
    export const Params = Schema.object({
      id: Schema.string().required(),
      type: Schema(TextureType).required(),
    });
  }
}

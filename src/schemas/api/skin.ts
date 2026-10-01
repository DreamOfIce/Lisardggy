import { InferType } from "fastify-type-provider-schemastery";
import Schema from "schemastery";

export namespace Skin {
  export namespace Textures {
    export type Params = InferType<typeof Params>;
    export const Params = Schema.object({ hash: Schema.string().required() });
  }
  export namespace MinecraftSkins {
    export type Params = InferType<typeof Params>;
    export const Params = Schema.object({ name: Schema.string().required() });
  }
}

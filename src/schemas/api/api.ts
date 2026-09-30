import type { InferType } from "fastify-type-provider-schemastery";
import Schema from "schemastery";

import { ProfileBase } from "../profile";

export namespace APIServer {
  export namespace Profiles {
    export type Body = InferType<typeof Body>;
    export const Body = Schema.array(Schema.string()).min(1).max(10);

    export type Response = InferType<typeof Response>;
    export const Response = Schema.array(ProfileBase);
  }

  export namespace ProfileByName {
    export interface Params {
      name: string;
    }
    export const Params: Schema<Params> = Schema.object({
      name: Schema.string(),
    });

    export type Response = ProfileBase;
    export const Response = ProfileBase;
  }
}

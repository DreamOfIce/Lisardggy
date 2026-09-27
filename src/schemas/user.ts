import { InferType } from "fastify-type-provider-schemastery";
import Schema from "schemastery";

import { Property } from "./property";

export type User = InferType<typeof User>;
export const User = Schema.object({
  id: Schema.string().required(),
  properties: Schema.array(Property).required(),
}).required(false);

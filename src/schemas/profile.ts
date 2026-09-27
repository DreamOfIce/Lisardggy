import { InferType } from "fastify-type-provider-schemastery";
import Schema from "schemastery";

import { Property } from "./property";

export type Profile = InferType<typeof Profile>;
export const Profile = Schema.object({
  id: Schema.string().required(),
  name: Schema.string().required(),
  properties: Schema.array(Property).required(),
}).required(false);

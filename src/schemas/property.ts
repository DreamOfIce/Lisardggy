import { InferType } from "fastify-type-provider-schemastery";
import Schema from "schemastery";

export type Property = InferType<typeof Property>;
export const Property = Schema.object({
  name: Schema.string().required(),
  value: Schema.string().required(),
});

export const PropertyWithSignature = Schema.intersect([
  Property,
  Schema.object({
    signature: Schema.string().required(),
  }),
]);

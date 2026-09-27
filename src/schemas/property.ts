import Schema from "schemastery";

export const Property = Schema.object({
  name: Schema.string().required(),
  value: Schema.string().required(),
});

export const PropertyWithSignature = Schema.union([
  Property,
  Schema.object({
    signature: Schema.string().required(),
  }),
]);

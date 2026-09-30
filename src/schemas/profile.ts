import { InferType } from "fastify-type-provider-schemastery";
import Schema from "schemastery";

import { Property, PropertyWithSignature } from "./property";

export type ProfileBase = InferType<typeof ProfileBase>;
export const ProfileBase = Schema.object({
  id: Schema.string().required(),
  name: Schema.string().required(),
}).required(false);

export type Profile = InferType<typeof Profile>;
export const Profile = Schema.object({
  id: Schema.string().required(),
  name: Schema.string().required(),
  properties: Schema.array(Property).required(),
}).required(false);

export type ProfileWithSignature = InferType<typeof ProfileWithSignature>;
export const ProfileWithSignature = Schema.object({
  id: Schema.string().required(),
  name: Schema.string().required(),
  properties: Schema.array(PropertyWithSignature).required(),
}).required(false);

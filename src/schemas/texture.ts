import type { Dict } from "cosmokit";
import Schema from "schemastery";

export type TextureType = "skin" | "cape";
export const TextureType: Schema<TextureType> = Schema.union(["skin", "cape"]);

export interface Texture {
  url: string;
  metadata?: Dict<string>;
}

export const Texture: Schema<Texture> = Schema.object({
  url: Schema.string().required(),
  metadata: Schema.dict(Schema.string()),
});

export interface Textures {
  timestamp: number;
  profileId: string;
  profileName: string;
  textures: Dict<Texture, Uppercase<TextureType>>;
}
export const Textures = Schema.object({
  timestamp: Schema.number().required(),
  profileId: Schema.string().required(),
  profileName: Schema.string().required(),
  textures: Schema.dict(Texture),
});

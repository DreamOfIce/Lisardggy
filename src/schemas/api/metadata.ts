import Schema from "schemastery";

export namespace MetaData {
  export interface Response {
    meta: {
      serverName?: string;
      implementationName?: string;
      implementationVersion?: string;
      links?: {
        homepage?: string;
        register?: string;
      };
      "feature.non_email_login"?: boolean;
      "feature.legacy_skin_api"?: boolean;
      "feature.no_mojang_namespace"?: boolean;
      "feature.enable_mojang_anti_features"?: boolean;
      "feature.enable_profile_key"?: boolean;
      "feature.username_check"?: boolean;
    };
    skinDomains: string[];
    signaturePublickey: string;
  }
  export const Response: Schema<Response> = Schema.object({
    meta: Schema.object({
      serverName: Schema.string(),
      implementationName: Schema.string(),
      implementationVersion: Schema.string(),
      links: Schema.object({
        homepage: Schema.string(),
        register: Schema.string(),
      }).required(false),
      "feature.non_email_login": Schema.boolean(),
      "feature.legacy_skin_api": Schema.boolean(),
      "feature.no_mojang_namespace": Schema.boolean(),
      "feature.enable_mojang_anti_features": Schema.boolean(),
      "feature.enable_profile_key": Schema.boolean(),
      "feature.username_check": Schema.boolean(),
    }),
    skinDomains: Schema.array(Schema.string()).required(),
    signaturePublickey: Schema.string().required(),
  });
}

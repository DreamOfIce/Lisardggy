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
    };
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
    }),
    signaturePublickey: Schema.string().required(),
  });
}

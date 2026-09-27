import Schema from "schemastery";

export namespace MetaData {
  export const Response = Schema.object({
    meta: Schema.object({
      serverName: Schema.string(),
      implementationName: Schema.string(),
      implementationVersion: Schema.string(),
      links: Schema.object({
        homepage: Schema.string(),
        register: Schema.string(),
      }),
    }),
  });
}

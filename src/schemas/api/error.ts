import Schema from "schemastery";

export interface Error {
  error: string;
  errorMessage: string;
  cause?: string;
}

export const Error: Schema<Error> = Schema.object({
  error: Schema.string().required(),
  errorMessage: Schema.string().required(),
  cause: Schema.string(),
});

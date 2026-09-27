import { FastifyError } from "@fastify/error";
import type { Dict } from "cosmokit";

import { API } from "./schemas";
import type { FastifyInstance } from "./utils";

export class YggdrasilServerError extends Error {
  public code: number;
  public response: API.Error;

  constructor(type: YggdrasilErrors);
  constructor(message: string, options?: { cause?: string; code?: number });
  constructor(
    typeOrMessage: YggdrasilErrors | string,
    { cause, code }: { cause?: string; code?: number } = {},
  ) {
    if (typeof typeOrMessage === "string") {
      super(typeOrMessage, { cause });
      this.code = code ?? 500;
      this.response = {
        error: "Internal Server Error",
        errorMessage: this.message,
      };
      if (cause) this.response.cause = cause;
    } else {
      const [code, response] = errorResponses[typeOrMessage];
      super(response.errorMessage);
      this.code = code;
      this.response = response;
    }
  }
}

export enum YggdrasilErrors {
  AssignInvalidProfile,
  AssignInvalidToken,
  AuthInvalidCredential,
  AuthInvalidToken,
  SessionInvalidProfile,
}

export const errorResponses = {
  [YggdrasilErrors.AssignInvalidProfile]: [
    403,
    {
      error: "ForbiddenOperationException",
      errorMessage: "Access token cannot be assigned to request profile.",
    },
  ],
  [YggdrasilErrors.AssignInvalidToken]: [
    400,
    {
      error: "IllegalArgumentException",
      errorMessage: "Access token already has a profile assigned.",
    },
  ],
  [YggdrasilErrors.AuthInvalidToken]: [
    403,
    {
      error: "ForbiddenOperationException",
      errorMessage: "Invalid token.",
    },
  ],
  [YggdrasilErrors.AuthInvalidCredential]: [
    403,
    {
      error: "ForbiddenOperationException",
      errorMessage: "Invalid credentials. Invalid username or password.",
    },
  ],
  [YggdrasilErrors.SessionInvalidProfile]: [
    403,
    {
      error: "ForbiddenOperationException",
      errorMessage: "Invalid token.",
    },
  ],
} as const satisfies Dict<[number, API.Error]>;

export const errorHandler: Parameters<FastifyInstance["setErrorHandler"]>[0] = (
  error,
  request,
  reply,
) => {
  reply.log.error(error);
  if (error instanceof YggdrasilServerError) {
    const { code, response } = error;
    return reply.code(code).send(response);
  } else if (error instanceof FastifyError) {
    const response: API.Error = {
      error: error.name,
      errorMessage: error.message,
    };
    if (typeof error.cause === "string") response.cause = error.cause;
    return reply.code(error.statusCode ?? 500).send(error);
  } else {
    const response: API.Error = {
      error: "Internal Server Error",
      errorMessage:
        error instanceof Error
          ? error.message
          : (error?.toString() ?? `Unexpected error(ReqID:${request.id})`),
    };
    if (error instanceof Error && typeof error.cause === "string") response.cause = error.cause;
    return reply.code(500).send(response);
  }
};

import type {
  FastifyBaseLogger,
  FastifyInstance as FastifyInstanceBase,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerBase,
  RawServerDefault,
} from "fastify";
import { SchemasteryTypeProvider } from "fastify-type-provider-schemastery";

export type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

export type FastifyInstance<
  RawServer extends RawServerBase = RawServerDefault,
  RawRequest extends RawRequestDefaultExpression<RawServer> =
    RawRequestDefaultExpression<RawServer>,
  RawReply extends RawReplyDefaultExpression<RawServer> = RawReplyDefaultExpression<RawServer>,
  Logger extends FastifyBaseLogger = FastifyBaseLogger,
> = FastifyInstanceBase<RawServer, RawRequest, RawReply, Logger, SchemasteryTypeProvider>;

import * as E from 'fp-ts/Either'
import * as D from 'io-ts/lib/Decoder'
import { pipe, flow } from 'fp-ts/function'
import { unexpectedValue, UnexpectedValue } from './commonErrors'

export function failureToError<A>(
  e: E.Either<D.DecodeError, A>,
): E.Either<UnexpectedValue, A> {
  return pipe(e, E.mapLeft(flow(D.draw, unexpectedValue)))
}

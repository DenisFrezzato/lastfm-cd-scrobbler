import * as E from 'fp-ts/lib/Either'
import * as t from 'io-ts'
import { failure } from 'io-ts/lib/PathReporter'

export const failureToError = <A>(
  e: E.Either<t.Errors, A>,
): E.Either<Error, A> =>
  E.either.mapLeft(e, (errors) => new Error(failure(errors).join('')))

import * as E from 'fp-ts/lib/Either'
import { flow } from 'fp-ts/lib/function'
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray'
import * as T from 'fp-ts/lib/Tree'
import { draw } from 'io-ts/lib/Tree'

export const failureToError = <A>(
  e: E.Either<NonEmptyArray<T.Tree<string>>, A>,
): E.Either<Error, A> =>
  E.either.mapLeft(
    e,
    flow(
      draw,
      (m) => new Error(m),
    ),
  )

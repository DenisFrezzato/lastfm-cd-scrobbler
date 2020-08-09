import { constVoid, pipe } from 'fp-ts/function'
import * as TE from 'fp-ts/TaskEither'
import * as opn from 'open'
import { SomeException, toSomeException } from './commonErrors'

export function open(
  target: string,
  options?: opn.Options,
): TE.TaskEither<SomeException, void> {
  return pipe(
    TE.tryCatch(() => opn(target, options), toSomeException),
    TE.map(constVoid),
  )
}

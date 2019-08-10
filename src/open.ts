import { toError } from 'fp-ts/lib/Either'
import { constVoid } from 'fp-ts/lib/function'
import * as TE from 'fp-ts/lib/TaskEither'
import * as opn from 'open'

export const open = (
  target: string,
  options?: opn.Options,
): TE.TaskEither<Error, void> =>
  TE.taskEither.map(TE.tryCatch(() => opn(target, options), toError), constVoid)

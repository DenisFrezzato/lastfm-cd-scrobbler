import * as E from 'fp-ts/lib/Either'
import * as TE from 'fp-ts/lib/TaskEither'
import * as readline from 'readline'

export const waitForConfirm = (
  message: string,
): TE.TaskEither<Error, void> => () => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(message, () => {
      rl.close()
      resolve(E.right(undefined))
    })
  })
}

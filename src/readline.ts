import * as readline from 'readline'
import * as T from 'fp-ts/lib/Task'

export function waitForConfirm(message: string): T.Task<void> {
  return () => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    return new Promise((resolve) => {
      rl.question(message, () => {
        rl.close()
        resolve(undefined)
      })
    })
  }
}

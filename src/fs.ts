import * as TE from 'fp-ts/lib/TaskEither'
import * as fs from 'fs'
import { toSomeException } from './commonErrors'
import { flow } from 'fp-ts/function'

export const readFile = flow(
  TE.taskify(fs.readFile),
  TE.mapLeft(toSomeException),
)

export const writeFile = flow(
  TE.taskify(fs.writeFile),
  TE.mapLeft(toSomeException),
)

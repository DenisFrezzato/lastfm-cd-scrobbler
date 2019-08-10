import { taskify } from 'fp-ts/lib/TaskEither'
import * as fs from 'fs'

export const readFile = taskify(fs.readFile)

export const writeFile = taskify(fs.writeFile)

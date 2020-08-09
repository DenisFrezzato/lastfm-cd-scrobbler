import { RequestFailure } from './fetch'

export interface SomeException {
  _type: 'SomeException'
  exception: Error
}

export function toSomeException(u: unknown): SomeException {
  const exception =
    u instanceof Error
      ? u
      : new Error(`Unexpected thrown value: got ${JSON.stringify(u)}`)
  return { _type: 'SomeException', exception }
}

export interface UnexpectedValue {
  _type: 'UnexpectedValue'
  message: string
}

export function unexpectedValue(message: string): UnexpectedValue {
  return { _type: 'UnexpectedValue', message }
}

export type AppError = UnexpectedValue | RequestFailure | SomeException

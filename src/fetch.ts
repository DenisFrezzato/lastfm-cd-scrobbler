import { flow, pipe } from 'fp-ts/function'
import * as TE from 'fp-ts/TaskEither'
import * as D from 'io-ts/lib/Decoder'
import nodeFetch, { RequestInfo, RequestInit, Response } from 'node-fetch'
import { failureToError } from './error'
import { toSomeException, AppError } from './commonErrors'

export interface RequestFailure {
  _type: 'RequestFailure'
  response: Response
  body: string
}

function requestFailure(response: Response): (body: string) => RequestFailure {
  return (body) => ({ _type: 'RequestFailure', response, body })
}

export function fetch(
  url: RequestInfo,
  init?: RequestInit,
): TE.TaskEither<AppError, Response> {
  return pipe(
    TE.tryCatch(() => nodeFetch(url, init), toSomeException),
    TE.chain((res) =>
      res.ok
        ? TE.right(res)
        : pipe(
            TE.tryCatch<AppError, string>(() => res.text(), toSomeException),
            TE.chainW(flow(requestFailure(res), TE.left)),
          ),
    ),
  )
}

export function fetchJson<A>(
  codec: D.Decoder<unknown, A>,
  url: RequestInfo,
  init?: RequestInit,
): TE.TaskEither<AppError, A> {
  return pipe(
    fetch(url, init),
    TE.chainW((res) => TE.tryCatch(() => res.json(), toSomeException)),
    TE.chainW(flow(codec.decode, failureToError, TE.fromEither)),
  )
}

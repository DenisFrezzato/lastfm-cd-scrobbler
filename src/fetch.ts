import * as E from 'fp-ts/lib/Either'
import { flow } from 'fp-ts/lib/function'
import { pipe } from 'fp-ts/lib/pipeable'
import * as TE from 'fp-ts/lib/TaskEither'
import * as D from 'io-ts/lib/Decoder'
import nodeFetch, { RequestInfo, RequestInit, Response } from 'node-fetch'
import { failureToError } from './error'

export const fetch = (
  url: RequestInfo,
  init?: RequestInit,
): TE.TaskEither<Error, Response> =>
  pipe(
    TE.tryCatch(() => nodeFetch(url, init), E.toError),
    TE.chain((res) =>
      res.ok
        ? TE.right(res)
        : TE.taskEither.chain(
            TE.tryCatch(() => res.text(), E.toError),
            flow(
              E.toError,
              TE.left,
            ),
          ),
    ),
  )

const failureToErrorTE = flow(
  failureToError,
  TE.fromEither,
)

export const fetchJson = <A>(
  codec: D.Decoder<A>,
  url: RequestInfo,
  init?: RequestInit,
): TE.TaskEither<Error, A> =>
  pipe(
    fetch(url, init),
    TE.chain((res) => TE.tryCatch(() => res.json(), E.toError)),
    TE.chain((u) => failureToErrorTE(codec.decode(u))),
  )

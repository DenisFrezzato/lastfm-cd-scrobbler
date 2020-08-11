import * as A from 'fp-ts/Array'
import { pipe, flow, identity } from 'fp-ts/function'
import * as Ord from 'fp-ts/Ord'
import * as R from 'fp-ts/Record'
import * as TE from 'fp-ts/TaskEither'
import * as D from 'io-ts/lib/Decoder'
import * as md5 from 'md5'
import * as qs from 'querystring'

import { fetch, fetchJson } from './fetch'
import { open } from './open'
import { SomeException, AppError } from './commonErrors'
import { Newtype, iso } from 'newtype-ts'

type QueryRecord = Record<string, string | number>
type QueryTuple = [string, string | number]

export interface Track {
  artist: string
  track: string
  trackNumber: number
  album: string
}
const baseUrl = 'https://ws.audioscrobbler.com/2.0'

function createUrl(method: string, query?: QueryRecord): string {
  return `${baseUrl}/?${qs.stringify({ method, ...query })}`
}

const byKey = Ord.contramap((tuple: QueryTuple) => tuple[0])(Ord.ordString)
const concatKeyValues: (as: QueryTuple[]) => string = A.reduce(
  '',
  (acc, [key, value]) => `${acc}${key}${value}`,
)

const createSignature: (apiSecret: string) => (query: QueryRecord) => string = (
  apiSecret: string,
) =>
  flow(
    R.filterWithIndex((key) => key !== 'format'),
    R.toArray,
    A.sortBy([byKey]),
    concatKeyValues,
    (_) => _ + apiSecret,
    md5,
  )

function signedQuery(query: QueryRecord, apiSecret: string): string {
  const signature = createSignature(apiSecret)(query)
  return qs.stringify({ ...query, api_sig: signature })
}

function createSignedUrl(
  method: string,
  query: QueryRecord,
  apiSecret: string,
): string {
  return `${baseUrl}/?${signedQuery({ method, ...query }, apiSecret)}`
}

interface Token extends Newtype<{ readonly Token: unique symbol }, string> {}
const Token = iso<Token>()

const GetTokenResponse = D.type({ token: D.string })

export function getToken(apiKey: string): TE.TaskEither<AppError, Token> {
  return pipe(
    fetchJson(
      GetTokenResponse,
      createUrl('auth.gettoken', { api_key: apiKey, format: 'json' }),
    ),
    TE.map((_) => Token.wrap(_.token)),
  )
}

export function requestAuth(
  apiKey: string,
  token: Token,
): TE.TaskEither<SomeException, void> {
  return open(
    `http://www.last.fm/api/auth/?${qs.stringify({
      api_key: apiKey,
      token: Token.unwrap(token),
    })}`,
  )
}

export interface SessionKey
  extends Newtype<{ readonly SessionKey: unique symbol }, string> {}
export const SessionKey = iso<SessionKey>()

const GetSessionResponse = D.type({
  session: D.type({
    name: D.string,
    key: D.string,
  }),
})

export function getSession(
  apiKey: string,
  apiSecret: string,
  token: Token,
): TE.TaskEither<AppError, SessionKey> {
  return pipe(
    fetchJson(
      GetSessionResponse,
      createSignedUrl(
        'auth.getsession',
        { api_key: apiKey, token: Token.unwrap(token), format: 'json' },
        apiSecret,
      ),
    ),
    TE.map((_) => SessionKey.wrap(_.session.key)),
  )
}

const paramWithIndex = (index: number) => (name: string): string =>
  `${name}[${index}]`

function createScrobbleIndexedParams(
  index: number,
  track: Track,
  timestamp: number,
): QueryRecord {
  const withIndex = paramWithIndex(index)

  return {
    ...R.reduceWithIndex(
      identity<QueryRecord>({}),
      (
        name: keyof Track,
        acc: QueryRecord,
        value: string | number,
      ): QueryRecord => ({
        ...acc,
        [withIndex(name)]: value,
      }),
    )(track),
    [withIndex('timestamp')]: timestamp,
  }
}

export function scrobble(
  apiKey: string,
  apiSecret: string,
  sessionKey: SessionKey,
  tracks: Track[],
  timestamp: number,
): TE.TaskEither<AppError, unknown> {
  const tracksQuery = tracks.reduce<QueryRecord>(
    (acc, track, i) => ({
      ...acc,
      ...createScrobbleIndexedParams(i, track, timestamp),
    }),
    {},
  )

  return fetch(
    createSignedUrl(
      'track.scrobble',
      {
        api_key: apiKey,
        sk: SessionKey.unwrap(sessionKey),
        format: 'json',
        ...tracksQuery,
      },
      apiSecret,
    ),
    { method: 'POST' },
  )
}

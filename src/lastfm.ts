import * as A from 'fp-ts/lib/Array'
import { flow, identity } from 'fp-ts/lib/function'
import * as Ord from 'fp-ts/lib/Ord'
import { pipe } from 'fp-ts/lib/pipeable'
import * as R from 'fp-ts/lib/Record'
import * as TE from 'fp-ts/lib/TaskEither'
import * as t from 'io-ts'
import * as md5 from 'md5'
import * as qs from 'querystring'

import { fetch, fetchJson } from './fetch'
import { open } from './open'

type QueryRecord = Record<string, string | number>
type QueryTuple = [string, string | number]

export interface Track {
  artist: string
  track: string
  trackNumber: number
  album: string
}
const baseUrl = 'https://ws.audioscrobbler.com/2.0'

const createUrl = (method: string, query?: QueryRecord): string =>
  `${baseUrl}/?${qs.stringify({ method, ...query })}`

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

const signedQuery = (query: QueryRecord, apiSecret: string): string => {
  const signature = createSignature(apiSecret)(query)
  return qs.stringify({ ...query, api_sig: signature })
}

const createSignedUrl = (
  method: string,
  query: QueryRecord,
  apiSecret: string,
): string => `${baseUrl}/?${signedQuery({ method, ...query }, apiSecret)}`

const GetTokenResponse = t.type({ token: t.string })

export const getToken = (apiKey: string): TE.TaskEither<Error, string> =>
  pipe(
    fetchJson(
      GetTokenResponse,
      createUrl('auth.gettoken', { api_key: apiKey, format: 'json' }),
    ),
    TE.map((_) => _.token),
  )

export const requestAuth = (
  apiKey: string,
  token: string,
): TE.TaskEither<Error, void> =>
  open(
    `http://www.last.fm/api/auth/?${qs.stringify({
      api_key: apiKey,
      token,
    })}`,
  )

const GetSessionResponse = t.type({
  session: t.type({
    name: t.string,
    key: t.string,
  }),
})

export const getSession = (
  apiKey: string,
  apiSecret: string,
  token: string,
): TE.TaskEither<Error, string> =>
  pipe(
    fetchJson(
      GetSessionResponse,
      createSignedUrl(
        'auth.getsession',
        { api_key: apiKey, token, format: 'json' },
        apiSecret,
      ),
    ),
    TE.map((_) => _.session.key),
  )

const paramWithIndex = (index: number) => (name: string): string =>
  `${name}[${index}]`

const createScrobbleIndexedParams = (
  index: number,
  track: Track,
  timestamp: number,
): QueryRecord => {
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

export const scrobble = (
  apiKey: string,
  apiSecret: string,
  sessionKey: string,
  tracks: Track[],
  timestamp: number,
): TE.TaskEither<Error, unknown> => {
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
        sk: sessionKey,
        format: 'json',
        ...tracksQuery,
      },
      apiSecret,
    ),
    { method: 'POST' },
  )
}

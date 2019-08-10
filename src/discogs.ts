import * as TE from 'fp-ts/lib/TaskEither'
import * as t from 'io-ts'

import { fetchJson } from './fetch'

const createUrl = (endpoint: string) => `https://api.discogs.com${endpoint}`

const ReleaseResponse = t.type({
  title: t.string,
  artists: t.array(
    t.type({
      name: t.string,
    }),
  ),
  tracklist: t.array(
    t.type({
      duration: t.string,
      position: t.string,
      title: t.string,
    }),
  ),
})
export type ReleaseResponse = t.TypeOf<typeof ReleaseResponse>

export const findRelease = (
  releaseId: number,
): TE.TaskEither<Error, ReleaseResponse> =>
  TE.taskEither.map(
    fetchJson(ReleaseResponse, createUrl(`/releases/${releaseId}`)),
    (release) => ({
      ...release,
      artists: release.artists.map((artist) => ({
        ...artist,
        // Some artists may have a indexed suffix like ` (2)`, remove it.
        name: artist.name.replace(/\(\d+\)/, '').trim(),
      })),
    }),
  )

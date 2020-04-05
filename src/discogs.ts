import * as TE from 'fp-ts/lib/TaskEither'
import * as D from 'io-ts/lib/Decoder'

import { fetchJson } from './fetch'

const createUrl = (endpoint: string) => `https://api.discogs.com${endpoint}`

const ReleaseResponse = D.type({
  title: D.string,
  artists: D.array(D.type({ name: D.string })),
  tracklist: D.array(
    D.type({
      duration: D.string,
      position: D.string,
      title: D.string,
    }),
  ),
})
export interface ReleaseResponse extends D.TypeOf<typeof ReleaseResponse> {}

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
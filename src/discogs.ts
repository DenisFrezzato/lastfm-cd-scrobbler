import * as TE from 'fp-ts/TaskEither'
import * as D from 'io-ts/lib/Decoder'
import * as L from 'monocle-ts/Lens'
import * as T from 'monocle-ts/Traversal'
import * as A from 'fp-ts/Array'
import { pipe } from 'fp-ts/function'

import { fetchJson } from './fetch'
import { AppError } from './commonErrors'
import { IntFromString } from './IntFromString'

function createUrl(endpoint: string) {
  return `https://api.discogs.com${endpoint}`
}

const Track = D.type({
  type_: D.literal('track'),
  duration: D.string,
  position: IntFromString,
  title: D.string,
})
interface Track extends D.TypeOf<typeof Track> {}

const Heading = D.type({
  type_: D.literal('heading'),
})
interface Heading extends D.TypeOf<typeof Heading> {}

const TrackItem = D.union(Track, Heading)

const Artist = D.type({ name: D.string })
interface Artist extends D.TypeOf<typeof Artist> {}

const ReleaseRsp = D.type({
  title: D.string,
  artists: D.array(Artist),
  tracklist: D.array(TrackItem),
})
interface ReleaseRsp extends D.TypeOf<typeof ReleaseRsp> {}

const findTracks = (release: ReleaseRsp): Release => ({
  ...release,
  tracklist: pipe(
    release.tracklist,
    A.filter((t): t is Track => t.type_ === 'track'),
  ),
})

const fixArtistNameL = pipe(
  L.id<ReleaseRsp>(),
  L.prop('artists'),
  L.traverse(A.array),
  T.prop('name'),
  // Some artists may have a indexed suffix like ` (2)`, remove it.
  T.modify((name) => name.replace(/\(\d+\)/, '').trim()),
)

export interface Release {
  title: string
  artists: Artist[]
  tracklist: Track[]
}

export function findRelease(
  releaseId: number,
): TE.TaskEither<AppError, Release> {
  return TE.taskEither.map(
    fetchJson(ReleaseRsp, createUrl(`/releases/${releaseId}`)),
    (release) => pipe(release, fixArtistNameL, findTracks),
  )
}

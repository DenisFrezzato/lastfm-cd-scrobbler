import { Do } from 'fp-ts-contrib/lib/Do'
import * as C from 'fp-ts/lib/Console'
import * as Date from 'fp-ts/lib/Date'
import * as E from 'fp-ts/lib/Either'
import { flow } from 'fp-ts/lib/function'
import { pipe } from 'fp-ts/lib/pipeable'
import * as TE from 'fp-ts/lib/TaskEither'
import { IntFromString } from 'io-ts-types/lib/IntFromString'
import { failure } from 'io-ts/lib/PathReporter'

import * as dgs from './discogs'
import * as fs from './fs'
import * as lfm from './lastfm'
import { waitForConfirm } from './readline'

const sessionKeyFilePath = `${__dirname}/.sessionKey`

const apiKey = '55d36c11988601f43ccca1b48cfc4e50'
const apiSecret = '032c9abb27bcd586983ad7cf9c9bebeb'

const log = flow(
  C.log,
  TE.rightIO,
)

const decodeReleaseId = (u: unknown): TE.TaskEither<Error, number> =>
  TE.fromEither(
    E.either.mapLeft(
      IntFromString.decode(u),
      (errors) => new Error(failure(errors).join('\n')),
    ),
  )

const nowInSeconds: TE.TaskEither<never, number> = TE.taskEither.map(
  TE.rightIO(Date.now),
  (ms) => Math.floor(ms / 1000),
)

const findReleaseById: TE.TaskEither<Error, dgs.ReleaseResponse> = Do(
  TE.taskEither,
)
  .bind('releaseId', decodeReleaseId(process.argv[2]))
  .doL(({ releaseId }) => log(`Looking for release ${releaseId} on Discogs...`))
  .bindL('release', ({ releaseId }) => dgs.findRelease(releaseId))
  .doL(({ release }) =>
    log(`Release found: ${release.artists[0].name} - ${release.title}`),
  )
  .return((_) => _.release)

const authoriseAndCacheSessionKey: TE.TaskEither<Error, string> = Do(
  TE.taskEither,
)
  .bind('token', lfm.getToken(apiKey))
  .doL(({ token }) => lfm.requestAuth(apiKey, token))
  .do(waitForConfirm('Authorise on Last.fm and press Enter '))
  .bindL('sessionKey', ({ token }) => lfm.getSession(apiKey, apiSecret, token))
  .doL(({ sessionKey }) => fs.writeFile(sessionKeyFilePath, sessionKey))
  .return((_) => _.sessionKey)

const formatReleaseToLastFMTracks = (
  release: dgs.ReleaseResponse,
): lfm.Track[] =>
  release.tracklist.map((track) => ({
    artist: release.artists[0].name,
    track: track.title,
    trackNumber: parseInt(track.position, 10),
    album: release.title,
  }))

export const main: TE.TaskEither<Error, unknown> = Do(TE.taskEither)
  .do(TE.right<Error, void>(undefined))
  .sequenceS({
    release: findReleaseById,
    now: nowInSeconds,
  })
  .sequenceS({
    sessionKey: pipe(
      fs.readFile(sessionKeyFilePath),
      TE.fold(
        () => authoriseAndCacheSessionKey,
        flow(
          String,
          TE.right,
        ),
      ),
    ),
  })
  .doL(({ sessionKey, release, now }) =>
    TE.taskEither.chain(log('Submitting tracks to Last.fm...'), () =>
      lfm.scrobble(
        apiKey,
        apiSecret,
        sessionKey,
        formatReleaseToLastFMTracks(release),
        now,
      ),
    ),
  )
  .done()

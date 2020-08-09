import { Do } from 'fp-ts-contrib/lib/Do'
import * as E from 'fp-ts/Either'
import * as C from 'fp-ts/Console'
import * as Date from 'fp-ts/Date'
import { flow, constVoid } from 'fp-ts/function'
import { pipe } from 'fp-ts/pipeable'
import * as TE from 'fp-ts/TaskEither'
import { IntFromString } from 'io-ts-types/lib/IntFromString'
import { failure } from 'io-ts/lib/PathReporter'

import * as dgs from './discogs'
import * as fs from './fs'
import * as lfm from './lastfm'
import { waitForConfirm } from './readline'
import { unexpectedValue, AppError } from './commonErrors'

const sessionKeyFilePath = `${__dirname}/.sessionKey`

const apiKey = '55d36c11988601f43ccca1b48cfc4e50'
const apiSecret = '032c9abb27bcd586983ad7cf9c9bebeb'

const log = flow(C.log, TE.rightIO)

function decodeReleaseId(u: unknown): TE.TaskEither<AppError, number> {
  return pipe(
    IntFromString.decode(u),
    E.mapLeft((errors) => unexpectedValue(failure(errors).join('\n'))),
    TE.fromEither,
  )
}

const nowInSeconds: TE.TaskEither<never, number> = TE.taskEither.map(
  TE.rightIO(Date.now),
  (ms) => Math.floor(ms / 1000),
)

const findReleaseById: TE.TaskEither<AppError, dgs.ReleaseResponse> = Do(
  TE.taskEither,
)
  .bind('releaseId', decodeReleaseId(process.argv[2]))
  .doL(({ releaseId }) => log(`Looking for release ${releaseId} on Discogs...`))
  .bindL('release', ({ releaseId }) => dgs.findRelease(releaseId))
  .doL(({ release }) =>
    log(`Release found: ${release.artists[0].name} - ${release.title}`),
  )
  .return((_) => _.release)

const authoriseAndCacheSessionKey: TE.TaskEither<AppError, string> = Do(
  TE.taskEither,
)
  .bind('token', lfm.getToken(apiKey))
  .doL(({ token }) => lfm.requestAuth(apiKey, token))
  .do(TE.rightTask(waitForConfirm('Authorise on Last.fm and press Enter ')))
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

export const main: TE.TaskEither<AppError, void> = Do(TE.taskEither)
  .do(TE.right<AppError, void>(undefined))
  .sequenceS({
    release: findReleaseById,
    now: nowInSeconds,
  })
  .sequenceS({
    sessionKey: pipe(
      fs.readFile(sessionKeyFilePath),
      TE.fold(() => authoriseAndCacheSessionKey, flow(String, TE.right)),
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
  .return(constVoid)

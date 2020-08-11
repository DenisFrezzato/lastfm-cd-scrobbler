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

const findReleaseById: TE.TaskEither<AppError, dgs.ReleaseResponse> = pipe(
  decodeReleaseId(process.argv[2]),
  TE.bindTo('releaseId'),
  TE.bind('release', ({ releaseId }) => dgs.findRelease(releaseId)),
  TE.chainFirstW(({ release }) =>
    pipe(log(`Release found: ${release.artists[0].name} - ${release.title}`)),
  ),
  TE.map((s) => s.release),
)

const authoriseAndCacheSessionKey: TE.TaskEither<
  AppError,
  lfm.SessionKey
> = pipe(
  lfm.getToken(apiKey),
  TE.bindTo('token'),
  TE.chainFirstW((s) =>
    pipe(
      lfm.requestAuth(apiKey, s.token),
      TE.chain(() =>
        TE.rightTask(waitForConfirm('Authorise on Last.fm and press Enter')),
      ),
    ),
  ),
  TE.bind('sessionKey', ({ token }) =>
    lfm.getSession(apiKey, apiSecret, token),
  ),
  TE.chainFirstW(({ sessionKey }) =>
    fs.writeFile(sessionKeyFilePath, lfm.SessionKey.unwrap(sessionKey)),
  ),
  TE.map((s) => s.sessionKey),
)

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
      TE.fold(
        () => authoriseAndCacheSessionKey,
        flow(String, (_) => lfm.SessionKey.wrap(_), TE.right),
      ),
    ),
  })
  .doL(({ sessionKey, release, now }) =>
    pipe(
      log('Submitting tracks to Last.fm...'),
      TE.chain(() =>
        lfm.scrobble(
          apiKey,
          apiSecret,
          sessionKey,
          formatReleaseToLastFMTracks(release),
          now,
        ),
      ),
    ),
  )
  .return(constVoid)

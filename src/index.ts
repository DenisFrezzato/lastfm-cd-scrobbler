import * as C from 'fp-ts/Console'
import * as Date from 'fp-ts/Date'
import { flow } from 'fp-ts/function'
import { pipe } from 'fp-ts/pipeable'
import * as TE from 'fp-ts/TaskEither'
import * as T from 'fp-ts/Task'

import * as dgs from './discogs'
import * as fs from './fs'
import * as lfm from './lastfm'
import { waitForConfirm } from './readline'
import { AppError } from './commonErrors'
import { IntFromString } from './IntFromString'
import { failureToError } from './error'

const sessionKeyFilePath = `${__dirname}/.sessionKey`

const apiKey = '55d36c11988601f43ccca1b48cfc4e50'
const apiSecret = '032c9abb27bcd586983ad7cf9c9bebeb'

const logTE = flow(C.log, TE.rightIO)
const logT = flow(C.log, T.fromIO)

function decodeReleaseId(u: unknown): TE.TaskEither<AppError, number> {
  return pipe(IntFromString.decode(u), failureToError, TE.fromEither)
}

const nowInSeconds: TE.TaskEither<never, number> = TE.taskEither.map(
  TE.rightIO(Date.now),
  (ms) => Math.floor(ms / 1000),
)

const findReleaseById: TE.TaskEither<AppError, dgs.Release> = pipe(
  decodeReleaseId(process.argv[2]),
  TE.bindTo('releaseId'),
  TE.bind('release', ({ releaseId }) => dgs.findRelease(releaseId)),
  TE.chainFirstW(({ release }) =>
    pipe(logTE(`Release found: ${release.artists[0].name} - ${release.title}`)),
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

function formatReleaseToLastFMTracks(release: dgs.Release): lfm.Track[] {
  return release.tracklist.map((track) => ({
    artist: release.artists[0].name,
    track: track.title,
    trackNumber: track.position,
    album: release.title,
  }))
}

export const main: T.Task<void> = pipe(
  nowInSeconds,
  TE.bindTo('now'),
  TE.apS('release', findReleaseById),
  TE.apSW(
    'sessionKey',
    pipe(
      fs.readFile(sessionKeyFilePath),
      TE.fold(
        () => authoriseAndCacheSessionKey,
        flow(String, (_) => lfm.SessionKey.wrap(_), TE.right),
      ),
    ),
  ),
  TE.chainFirst(({ sessionKey, release, now }) =>
    pipe(
      logTE('Submitting tracks to Last.fm...'),
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
  ),
  TE.fold(
    (error) => logT(`Something went wrong: ${JSON.stringify(error)}`),
    () => logT('Success!'),
  ),
)

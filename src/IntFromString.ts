import * as D from 'io-ts/lib/Decoder'
import { pipe } from 'fp-ts/function'

export const IntFromString: D.Decoder<unknown, number> = pipe(
  D.string,
  D.parse((s) => {
    const n = parseInt(s, 10)
    return isNaN(n) ? D.failure(s, 'IntFromString') : D.success(n)
  }),
)

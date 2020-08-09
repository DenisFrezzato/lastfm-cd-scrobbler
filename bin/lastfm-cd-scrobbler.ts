#!/usr/bin/env node

// tslint:disable:no-console

import { fold } from 'fp-ts/Either'
import { pipe } from 'fp-ts/function'

import { main } from '../src'

main().then((e) =>
  pipe(
    e,
    fold(
      (err) => console.error(`Something went wrong: ${JSON.stringify(err)}`),
      () => console.log('Success'),
    ),
  ),
)

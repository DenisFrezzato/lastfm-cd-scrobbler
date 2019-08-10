#!/usr/bin/env nod

// tslint:disable:no-console

import { fold } from 'fp-ts/lib/Either'
import { pipe } from 'fp-ts/lib/pipeable'

import { main } from '../src'

main().then((e) =>
  pipe(
    e,
    fold(
      (err) => console.error(`Something went wrong: ${err.message}`),
      () => console.log('Success'),
    ),
  ),
)

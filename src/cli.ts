#!/usr/bin/env node

import cluster from 'cluster'
import { run as runMaster } from './master'
import { runWorker } from './worker'
import 'source-map-support/register'
import 'ts-node/register'
import 'ignore-styles'
// const log = console.log
// console.log = (...args) => {
//   log(new Error)
//   log(...args)
// }
const error = console.error
const log = console.log

declare var global: any
process.on('uncaughtException', (err) => {
  if (cluster.isWorker) {
    for (const instance of Object.values(global.$$teztInstances)) {
      if (instance && (instance as any).isRunning) {
        return
      }
    }
  }
  error("There was an uncaught exception")
  error("It might be from an unresolved promise.")
  error(err)
  process.exit(1)
})

process.on('unhandledRejection', (err) => {
  error("There was an unhandled rejection")
  error(err)
  process.exit(1)
})

process.env.TEZT = "cli"
process.env.FORCE_COLOR = process.env.FORCE_COLOR || "1"
process.env.NODE_ENV="test"
async function main() {
  try {
    if (cluster.isMaster) {
      await runMaster()
    } else {
      await runWorker()
    }
  } catch (err) {
    error(err)
  }
}

main().catch(console.error)
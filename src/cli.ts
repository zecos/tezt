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

process.on('uncaughtException', (error) => {
  console.error("There was an uncaught exception")
  console.error(error)
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
    console.error(err)
    console.log('caught error')
  }
}

main().catch(console.error)
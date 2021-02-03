import fs from 'fs-extra'
import path from 'path'
import glob from 'glob-promise'
import { RUN } from './msg'
import chalk from 'chalk'
import {getConfig} from './config'
import chokidar from 'chokidar'
import os from 'os'
import { genRunners } from './runners'
import 'source-map-support/register'
import 'ts-node/register'
import ipc from 'node-ipc'

process.on('uncaughtException', (err) => {
  console.error('uncaught exception')
  console.error(err)
  process.exit(1)
})
process.on('unhandledRejection', (err) => {
  console.error('uncaught rejection')
  console.error(err)
  process.exit(1)
})

const MAX_RUNNERS = 4

process.env.TEZT = "cli"
process.env.FORCE_COLOR = process.env.FORCE_COLOR || "1"
process.env.NODE_ENV="test"
const { log } = console
async function main() {
  const config = await getConfig()

  if (!config.watch) {
    const getRunner = await genRunners(1)
    await runTests({getRunner, config})
    process.exit()
  }
  const numCPUs = os.cpus().length
  const numRunners = Math.min(numCPUs, MAX_RUNNERS)
  const getRunner = await genRunners(numRunners)

  let running = false
  chokidar
    .watch([config.watchPatterns, config.testPatterns], {
      ignored: config.ignorePatterns,
      ignoreInitial: false,
    })
    .on('all', async (...args) => {
      if (!running) {
        running = true
        setTimeout(async () => {
          try {
            await runTests({getRunner, config})
          } catch (err) {
            console.error('There was an error starting the tests.')
          }
          running = false
        }, 500)
      }
    })
    .on('ready', () => {
      console.log(chalk.cyan('Watching for changes...'))
    })
}

main().catch(console.error)

async function runTests({config, getRunner}) {
  const runner = await getRunner()
  const {subprocess, socket} = runner
  const testFiles = await getAllTestFiles(config)
  ipc.server.emit(
    socket,
    'tezt.message',
    {
      type: RUN,
      config,
      testFiles,
    }
  )
  await new Promise((res, rej) => {
    subprocess.on('exit', (code, signal) => {
      if (signal) {
        return res(`Runner was killed by signal: ${signal}`)
      }
      if (code !== 0) {
        return rej(`Runner exited with code: ${code}`)
      }
      return res('Success')
    })
  })
}

async function getAllTestFiles(config) {
  let files: string[] = []
  for (const testPath of config.testPaths) {
    if (!fs.existsSync(testPath)) {
      console.error(`Could not find ${testPath}`)
      process.exit(1)
    }
    const stats  = await fs.lstat(testPath)
    if (stats.isFile()) {
      files.push(testPath)
      continue
    }
    const globFiles = await glob(config.testPatterns, {
      cwd: testPath,
      root: config.root || process.cwd(),
      ignore: config.ignorePatterns,
    })
    files = files.concat(globFiles.map(file => (
      path.relative(process.cwd(), path.resolve(testPath, file))
    )))
  }
  return files
}
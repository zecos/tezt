import fs from 'fs-extra'
import path from 'path'
import glob from 'glob-promise'
import chalk from 'chalk'
import {getConfig} from './config'
import chokidar from 'chokidar'
import os from 'os'
import { genWorkers } from './workers'
import { RUN } from './msg'

const MAX_WORKERS = 4

const log = console.log

export const run = async () => {
  const config = await getConfig()

  if (!config.watch) {
    const workers = genWorkers(1)
    await runTests({workers, config})
    process.exit()
  }
  const numCPUs = os.cpus().length
  const numWorkers = Math.min(numCPUs, MAX_WORKERS)
  const workers = genWorkers(numWorkers)

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
            await runTests({workers, config})
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

async function runTests({config, workers}) {
  const worker = await workers.next().value
  const testFiles = await getAllTestFiles(config)
  worker.send({
    type: RUN,
    config,
    testFiles,
  })
  await new Promise((res, rej) => {
    worker.on('exit', (code, signal) => {
      if (signal) {
        return res(`Worker was killed by signal: ${signal}`)
      }
      if (code !== 0) {
        return rej(`Worker exited with code: ${code}`)
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
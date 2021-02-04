import chalk from 'chalk';
import { reset as singletonReset } from './tezt.singleton'
import { outputCompositeResults, outputResults } from './output';
import path from 'path'
import fetch from 'node-fetch'
import { READY, RUN } from './msg';
import ipc from 'node-ipc';
import 'ts-node/register'
import 'source-map-support/register'
import 'ignore-styles'

const error = console.error
const log = console.log

process.on('uncaughtException', (err) => {
  const singleton = global.$$teztSingleton
  if (singleton && singleton.isRunning) {
    return
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

let onlyFiles: string[] = []
let skipFiles: string[] = []

ipc.config.silent = true

export const main = async () =>  {
  ipc.connectTo('tezt-master', () => {
    const master = ipc.of['tezt-master']
    master
      .on('connect', () => {
        master.emit('tezt.message', {
            type: READY,
            pid: process.pid,
          })
      })
    master.on('tezt.message', async (msg, socket) => {
      if (msg.type === RUN) {
        try {
          await run(msg)
          process.exit()
        } catch (err) {
          console.error(err)
          process.exit(1)
        }
      } else {
        console.log(`Could not find msg type ${msg.type}`)
      }
    })
  })
}

export const run = async ({config, testFiles}) => {
  if (config.setup) {
    await import(path.resolve(config.root, config.setup))
  }
  const tezts: any[] = []
  global.globalBeforeEaches = []
  global.globalAfterEaches = []
  global.globalAfterAlls = []
  global.globalBeforeAlls = []
  const curTezt = global.$$teztSingleton
  if (typeof config.timeout !== "undefined") {
    global.$$teztSingleton.timeout = config.timeout
  }
  if (config.dom) {
    await emulateDom()
  }
  global.$$teztSingleton = curTezt
  for (const file of testFiles) {
    global.only = () => {
      onlyFiles.push(file)
    }
    global.skip = () => {
      skipFiles.push(file)
    }
    // @ts-ignore
    singletonReset()
    global.$$teztSingleton.file = file

    if (config.fns) {
      const { test } = await import(path.resolve(process.cwd(), file))
      if (typeof test === "function") {
        await test()
      }
    } else {
      await import('source-map-support/register')
      await import(path.resolve(process.cwd(), file))
    }
    tezts.push(global.$$teztSingleton)
  }

  const compositeStats: any[] = []
  for (const fn of global.globalBeforeAlls) {
    await fn()
  }
  for (const tezt of tezts) {
    if (skipFiles.includes(tezt.file)) {
      log(`Skipping: ${tezt.file}`)
      continue
    }
    let isOnly = false
    if (onlyFiles.length) {
      if (!onlyFiles.includes(tezt.file)) {
        continue
      }
      isOnly = true
    }
    const stats = await tezt.run()
    if (stats.totalRun === 0) {
      continue
    }
    log(chalk.bold(`File${isOnly ? " (Only)" : ""}: ${tezt.file}`))
    outputResults(stats)
    compositeStats.push(stats)
    log()
  }
  for (const fn of global.globalAfterAlls) {
    await fn()
  }
  if (compositeStats.length === 0) {
    log('There were no tests to run.')
  }
  if (compositeStats.length > 1) {
    outputCompositeResults(compositeStats)
  }

  if (config.teardown) {
    await import(path.resolve(config.root, config.teardown))
  }
}


declare var global: any;
const emulateDom = async () => {
  const { JSDOM } = await import('jsdom');

  const jsdom = new JSDOM('<!doctype html><html><body></body></html>');
  const { window } = jsdom;

  function copyProps(src, target) {
    Object.defineProperties(target, {
      ...Object.getOwnPropertyDescriptors(src),
      ...Object.getOwnPropertyDescriptors(target),
    });
  }

  global.window = window;
  global.document = window.document;
  global.navigator = {
    userAgent: 'node.js',
  };
  global.fetch = fetch
  global.requestAnimationFrame = function (callback) {
    return setTimeout(callback, 0);
  };
  global.cancelAnimationFrame = function (id) {
    clearTimeout(id);
  };
  copyProps(window, global);
}

main().catch(console.error)
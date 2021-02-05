global.$$TEZT_PARALLEL = true
const {log} = console
import chalk from 'chalk';
import { reset } from './tezt.singleton'
import { outputCompositeResults, outputResults } from './output';
import path from 'path'
import fetch from 'node-fetch'
import { READY, RUN, TERMINATE } from './msg';
import { ITezt, Tezt } from './Tezt';
const tezts = [...new Array(30)].map(() => new Tezt)

export const runWorker = () => (new Promise<void>((res, rej) => {
  process.send({type: READY})
  process.on('message', async (msg) => {
    if (msg.type === TERMINATE) {
      process.on('beforeExit', async () => {
        // in case they've put clean up in globalAfterAll
        for (const globalAfterAll of global.globalAfterAlls) {
          await globalAfterAll()
        }
      })
      process.exit()
    } else if (msg.type === RUN) {
      try {
        await run(msg)
        process.exit()
      } catch (err) {
        console.error(err)
        process.exit(1)
      }
    }
  })
}))

export const run = async ({config, testFiles}) => {
  reset()
  const instances = global.$$teztInstances
  if (config.setup) {
    await import(path.resolve(config.root, config.setup))
  }
  global.globalBeforeEaches = []
  global.globalAfterEaches = []
  global.globalAfterAlls = []
  global.globalBeforeAlls = []

  if (config.dom) {
    await emulateDom()
  }
  console.time('import')
  const importPromises = []
  for (const file of testFiles) {
    const tezt = tezts.pop() || new Tezt()
    Object.assign(tezt, {
      file,
      timeout: config.timeout,
      gracePeriod: config.gracePeriod
    })
    instances[file] = tezt

    importPromises.push(import(path.resolve(process.cwd(), file)))
  }
  await Promise.all(importPromises)
  console.timeEnd('import')

  const compositeStats: any[] = []
  for (const fn of global.globalBeforeAlls) {
    await fn()
  }
  const statPromises = []
  const hasOnlys = Object.values<ITezt>(instances)
    .some(instance => instance.isOnly)
  console.time('run')
  for (const tezt of Object.values<ITezt>(instances)) {
    if (tezt.isSkipped) {
      log(`Skipping: ${tezt.file}`)
      continue
    }
    let isOnly
    if (hasOnlys) {
      if (!tezt.isOnly) {
        continue
      }
      isOnly = true
    }
    console.time(tezt.file)
    const statPromise = tezt.run()
    statPromises.push({
      promise: statPromise,
      isOnly,
      file: tezt.file,
    })
  }

  for (const {promise, isOnly, file} of statPromises) {
    const stats = await promise
    console.timeEnd(file)
    if (stats.totalRun === 0) {
      continue
    }
    log(chalk.bold(`File${isOnly ? " (Only)" : ""}: ${file}`))
    outputResults(stats)
    compositeStats.push(stats)
    log()
  }
  console.timeEnd('run')
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
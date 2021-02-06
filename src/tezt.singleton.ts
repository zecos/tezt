// @ts-nocheck
import { Tezt } from './Tezt'
import { outputResults } from './output';
import 'source-map-support/register'
import { getLocation } from './location';
import path from 'path'
const originalPrepareStackTrace = Error.prepareStackTrace
Error.prepareStackTrace = (...args) => {
  return originalPrepareStackTrace(...args)
}

const noop = () => {}

const IN_NODE = typeof window === "undefined"
const IS_TEST = process.env.NODE_ENV === "test"
const global:any = IN_NODE ? global : window

const IN_OTHER = global.test ||  global.it

let tezt;
export const reset = (() => {
  if (!IS_TEST) {
    return noop
  }
  return () => {
    if (global.$$TEZT_PARALLEL) {
      global.$$teztInstances = []
    } else {
      global.$$teztSingleton = new Tezt
    }
  }
})()

if (!(global.$$teztSingleton || global.$$teztInstances)) {
  reset()
}

export const getInstance = () => {
  if (global.$$TEZT_PARALLEL) {
    const {filepath} = getLocation(/tezt\.singleton\.(t|j)s/)
    return global.$$teztInstances[path.relative(process.cwd(), filepath)]
  }
  return global.$$teztSingleton
}

const {log, warn, error} = console

export const test:any = (!IS_TEST && noop) || global.it || global.test || (() => {
  const fn = (...args) => {
    getInstance().test(...args)
  }
  fn.skip = (...args) => getInstance().test.skip(...args)
  fn.only = (...args) => getInstance().test.only(...args)
  return fn
})()

export const describe:any = (!IS_TEST && noop) || global.describe || (() => {
  const fn = (...args) => getInstance().describe(...args)
  fn.skip = (...args) => getInstance().describe.skip(...args)
  fn.only = (...args) => getInstance().describe.only(...args)
  return fn
})()

export const before = (!IS_TEST && noop) ||
  global.before ||
  global.beforeAll ||
  ((...args) => getInstance().before(...args))
export const beforeEach = (!IS_TEST && noop) ||
  global.beforeEach ||
  ((...args) => getInstance().beforeEach(...args))
export const globalBeforeEach = (!IS_TEST && noop) ||
  (fn => global.globalBeforeEaches.push(fn))
export const beforeAll = global.beforeAll ||
  ((...args) => getInstance().beforeAll(...args))
export const globalBeforeAll = (!IS_TEST && noop) || (fn => {
  global.globalBeforeAlls.push(fn)
})

export const after =  (!IS_TEST && noop) ||
  global.after ||
  global.afterAll ||
  ((...args) => getInstance().after(...args))
export const afterEach = (!IS_TEST && noop) ||
  global.afterEach ||
  ((...args) => getInstance().afterEach(...args))
export const globalAfterEach = (!IS_TEST && noop) ||
  (fn => global.globalAfterEaches.push(fn))
export const afterAll = (!IS_TEST && noop) ||
  global.afterAll ||
  ((...args) => getInstance().afterAll(...args))
export const globalAfterAll = fn => global.globalAfterAlls.push(fn)

export const only = (!IS_TEST && noop) || (() => {
  if (global.$$TEZT_PARALLEL) {
    getInstance().isOnly = true
  }
})
export const skip = (!IS_TEST && noop) || (() => {
  if (global.$$TEZT_PARALLEL) {
    getInstance().isSkipped = true
  }
})

export const expect = (!IS_TEST && noop) || require('expect')

let hasRun = false
process.on('beforeExit', async () => {
  if (process.env.NODE_ENV !== "test") {
    return
  }
  if (!hasRun && !IN_OTHER && !(process.env.TEZT === "cli")) {
    hasRun = true
    for (const globalBeforeAll of global.globalBeforeAlls) {
      await globalBeforeAll()
    }
    outputResults(await tezt.run())
    for (const globalAfterAll of global.globalAfterAlls) {
      await globalAfterAll()
    }
  }
})


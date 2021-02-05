// @ts-nocheck
import { Tezt } from './Tezt'
import { outputResults } from './output';
import 'source-map-support/register'
import { getLocation } from './location';
import { patchConsole } from './tezt.console';
import path from 'path'
const originalPrepareStackTrace = Error.prepareStackTrace
Error.prepareStackTrace = (...args) => {
  return originalPrepareStackTrace(...args)
}

const noop = () => {}

const IN_NODE = typeof window === "undefined"
const IS_TEST = process.env.NODE_ENV === "test"
let _global:any = IN_NODE ? global : window
const IS_PARALLEL = _global.$$TEZT_PARALLEL

const IN_OTHER = _global.test ||  _global.it

_global.globalAfterAlls = _global.globalAfterAlls || []
_global.globalBeforeAlls = _global.globalBeforeAlls || []

let tezt;
export const reset = (() => {
  if (!IS_TEST) {
    return noop
  }
  if (IS_PARALLEL) {
    return () => {
      _global.$$teztInstances = []
    }
  }
  return () => _global.$$teztSingleton = tezt = new Tezt
})()

if (!(_global.$$teztSingleton || _global.$$teztInstances)) {
  reset()
}

export const getInstance = () => {
  if (IS_PARALLEL) {
    const {filepath} = getLocation(/tezt\.singleton\.(t|j)s/)
    return _global.$$teztInstances[path.relative(process.cwd(), filepath)]
  }
  return _global.$$teztSingleton
}

const {log, warn, error} = console
patchConsole()

export const test:any = (!IS_TEST && noop) || _global.it || _global.test || (() => {
  const fn = (...args) => getInstance().test(...args)
  fn.skip = (...args) => getInstance().test.skip(...args)
  fn.only = (...args) => getInstance().test.only(...args)
  return fn
})()

export const describe:any = (!IS_TEST && noop) || _global.describe || (() => {
  const fn = (...args) => getInstance().describe(...args)
  fn.skip = (...args) => getInstance().describe.skip(...args)
  fn.only = (...args) => getInstance().describe.only(...args)
  return fn
})()

export const before = (!IS_TEST && noop) || _global.before || _global.beforeAll || ((...args) => getInstance().before(...args))
export const beforeEach = (!IS_TEST && noop) || _global.beforeEach || ((...args) => getInstance().beforeEach(...args))
export const globalBeforeEach = (!IS_TEST && noop) || (fn => _global.globalBeforeEaches.push(fn))
export const beforeAll = _global.beforeAll || ((...args) => getInstance().beforeAll(...args))
export const globalBeforeAll = (!IS_TEST && noop) || (fn => _global.globalBeforeAlls.push(fn))

export const after =  (!IS_TEST && noop) || _global.after || _global.afterAll || ((...args) => getInstance().after(...args))
export const afterEach = (!IS_TEST && noop) || _global.afterEach || ((...args) => getInstance().afterEach(...args))
export const globalAfterEach = (!IS_TEST && noop) || (fn => _global.globalAfterEaches.push(fn))
export const afterAll = (!IS_TEST && noop) || _global.afterAll || ((...args) => getInstance().afterAll(...args))
export const globalAfterAll = fn => _global.globalAfterAlls.push(fn)

export const only = (!IS_TEST && noop) || (() => {
  if (IS_PARALLEL) {
    getInstance().isOnly = true
  }
})
export const skip = (!IS_TEST && noop) || (() => {
  if (IS_PARALLEL) {
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
    for (const globalBeforeAll of _global.globalBeforeAlls) {
      await globalBeforeAll()
    }
    outputResults(await tezt.run())
    for (const globalAfterAll of _global.globalAfterAlls) {
      await globalAfterAll()
    }
  }
})


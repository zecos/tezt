// @ts-nocheck
import { Tezt } from './Tezt'
import { outputResults } from './output';
import 'source-map-support/register'
const originalPrepareStackTrace = Error.prepareStackTrace
Error.prepareStackTrace = (...args) => {
  return originalPrepareStackTrace(...args)
}

const noop = () => {}

const IN_NODE = typeof window === "undefined"
const IS_TEST = process.env.NODE_ENV === "test"
let _global:any = IN_NODE ? global : window

const IN_OTHER = _global.test ||  _global.it

_global.globalAfterAlls = _global.globalAfterAlls || []
_global.globalBeforeAlls = _global.globalBeforeAlls || []

let tezt;
const log = console.log
export const reset = (!IS_TEST && noop) || (() => _global.$$tezt = new Tezt)
if (!_global.$$tezt) {
  reset()
  log("global tezt not found")
} else {
  log('global tezt found')
}
tezt = _global.$$tezt

export const test:any = (!IS_TEST && noop) || _global.it || _global.test || (() => {
  const fn = (...args) => tezt.test(...args)
  fn.skip = (...args) => tezt.test.skip(...args)
  fn.only = (...args) => tezt.test.only(...args)
  return fn
})()

export const describe:any = (!IS_TEST && noop) || _global.describe || (() => {
  const fn = (...args) => tezt.describe(...args)
  fn.skip = (...args) => tezt.describe.skip(...args)
  fn.only = (...args) => tezt.describe.only(...args)
  return fn
})()

export const before = (!IS_TEST && noop) || _global.before || _global.beforeAll || ((...args) => tezt.before(...args))
export const beforeEach = (!IS_TEST && noop) || _global.beforeEach || ((...args) => tezt.beforeEach(...args))
export const beforeAll = _global.beforeAll || ((...args) => tezt.beforeAll(...args))
export const globalBeforeAll = (!IS_TEST && noop) || (fn => _global.globalBeforeAlls.push(fn))

export const after =  (!IS_TEST && noop) || _global.after || _global.afterAll || ((...args) => tezt.after(...args))
export const afterEach = (!IS_TEST && noop) || _global.afterEach || ((...args) => tezt.afterEach(...args))
export const afterAll = (!IS_TEST && noop) || _global.afterAll || ((...args) => tezt.afterAll(...args))
export const globalAfterAll = fn => _global.globalAfterAlls.push(fn)

export const only = (!IS_TEST && noop) || (() => {
  ;(_global.only || (() => {}))()
})
export const skip = (!IS_TEST && noop) || (() => {
  ;(_global.skip || (() => {}))()
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
import { Tezt } from './Tezt'
import { outputResults } from './output';
import 'source-map-support/register'
const originalPrepareStackTrace = Error.prepareStackTrace
Error.prepareStackTrace = (...args) => {
  return originalPrepareStackTrace(...args)
}

const IN_NODE = typeof window === "undefined"
let _global:any = IN_NODE ? global : window

const IN_OTHER = _global.test ||  _global.it


let tezt;
export const  reset = () => _global.$$tezt = tezt = new Tezt
reset()

export const test:any = _global.it || _global.test || (() => {
  const fn = (...args) => tezt.test(...args)
  fn.skip = (...args) => tezt.test.skip(...args)
  fn.only = (...args) => tezt.test.only(...args)
  return fn
})()

export const describe:any = _global.describe || (() => {
  const fn = (...args) => tezt.describe(...args)
  fn.skip = (...args) => tezt.describe.skip(...args)
  fn.only = (...args) => tezt.describe.only(...args)
  return fn
})()

export const after = _global.after || _global.afterAll || ((...args) => tezt.after(...args))
export const before = _global.before || _global.beforeAll || ((...args) => tezt.before(...args))
export const beforeEach = _global.beforeEach || ((...args) => tezt.beforeEach(...args))
export const afterEach = _global.afterEach || ((...args) => tezt.afterEach(...args))
export const only = IN_OTHER ? () => {} : ((...args) => tezt.only(...args))
export const skip = IN_OTHER ? () => {} : (...args) => tezt.skip(...args)

let hasRun = false
process.on('beforeExit', async () => {
  if (!hasRun && !IN_OTHER && !(process.env.TEZT === "cli")) {
    hasRun = true
    outputResults(await tezt.run())
  }
})
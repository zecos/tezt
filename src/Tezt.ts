import uuid from 'uuid/v4'
import { RunCallbacks, IRunCallbacks } from './RunCallbacks';
import { promisify } from 'util'

const actualLog = console.log
const actualWarn = console.warn
let runMaybe = () => {
  actualLog(maybeLog)
}
let maybeLog:any = ''

export type TVoidFunc = () => void
export interface IBlock {
  children: TItem[]
  afters: TVoidFunc[]
  befores: TVoidFunc[]
  beforeEaches: TVoidFunc[]
  afterEaches: TVoidFunc[]
  containsOnly: boolean
  totalTests: number
}

export class Block implements IBlock {
  onlys = []
  children = []
  afters = []
  befores = []
  beforeEaches = []
  afterEaches = []
  containsOnly = false
  totalTests = 0
}

export interface IItem {
  id: string
  name: string
  location: ILocation
  skip: boolean
  only: boolean
}

export class Item implements IItem {
  constructor(public name) {}
  id = new uuid()
  location = (() => (
    getLocation(/tezt\.singleton\.(t|j)s/, true)
  ))()
  skip = false
  only = false
}

export interface IDescribe extends IItem {}
export class Describe extends Item implements IDescribe {
  constructor(public name) {
    super(name)
  }
  block = new Block
}

export interface ITest extends IItem {
  fn: TVoidFunc
}
export class Test extends Item implements ITest {
  constructor(public name, public fn) {
    super(name)
  }
}

type TItem = ITest | IDescribe

interface IAdd {
  (name:string, fn: TVoidFunc, id?: string): void,
  skip: TSkip,
  only: TOnly,
}

type TSkip = (name:string, fn: TVoidFunc) => void
type TOnly = (name: string, fn: TVoidFunc) => void


export interface ITezt extends Block {
  containsOnly: boolean
  curBlock?: IBlock
  curAncestors: string[]
  test: IAdd
  describe: IAdd
  skip: TSkip
  only: TOnly
  skipLocations: string[]
  onlyLocations: string[]
  inOnly: boolean
  name: string
  file: string
}

export class Tezt extends Block implements ITezt {
  curAncestors = []
  block = new Block
  curBlock
  skipLocations = []
  onlyLocations = []
  inOnly = false
  containsOnly = false
  name = "tezt"
  file = (global as any).curFile
  beforeAlls = []
  afterAlls = []


  constructor() {
    super()
    this.curAncestors.push(this)
    this.curBlock = this.block
  }

  public test = (() => {
    const test = (name, fn) => {
      this.curBlock.totalTests++
      const test = new Test(name, fn)
      this.curBlock.children.push(test)
      if (this.inOnly) {
        for (const ancestor of this.curAncestors){
          ancestor.block.containsOnly = true
        }
        test.only = true
      }
      return test
    }
    test.skip = (name?, fn?) => {
      const prevInOnly = this.inOnly
      this.inOnly = false
      test(name, fn).skip = true
      this.inOnly = prevInOnly
    }
    test.only = (name, fn) => {
      const prevInOnly = this.inOnly
      this.inOnly = true
      const _only = test(name, fn)
      _only.only = true
      this.inOnly = prevInOnly
    }

    return test
  })()

  public describe = (() => {
    const describe = (name, fn) => {
      const describe = new Describe(name)
      const prevBlock = this.curBlock
      prevBlock.children.push(describe)
      this.curBlock = describe.block
      this.curAncestors.push(describe)
      fn()
      this.curAncestors.pop()
      this.curBlock = prevBlock
      return describe
    }

    describe.only = (name, fn) => {
      const prevInOnly = this.inOnly
      this.inOnly = true
      describe(name, fn).only = true
      this.inOnly = prevInOnly
    }
    describe.skip = (name, fn) =>{
      const prevInOnly = this.inOnly
      this.inOnly = false
      describe(name, fn).skip = true
      this.inOnly = prevInOnly
    }
    return describe
  })()

  public run = async () => {
    for (const beforeAll of this.beforeAlls) {
      await beforeAll()
    }
    const results = await run(this.curBlock)
    for (const afterAll of this.afterAlls) {
      await afterAll()
    }
    return results
  }

  public only = () => {
    this.onlyLocations.push(new RegExp(""))
  }

  public skip = () => {
    this.skipLocations.push(new RegExp(""))
  }

  public before     = fn => this.curBlock.befores.push(fn)
  public beforeEach = fn => this.curBlock.beforeEaches.push(fn)
  public beforeAll  = fn => this.beforeAlls.push(fn)
  public after      = fn => this.curBlock.afters.push(fn)
  public afterEach  = fn => this.curBlock.afterEaches.push(fn)
  public afterAll   = fn => this.afterAlls.push(fn)
}


export interface ILocation {
  filepath: string
  lineno: string
}

export class Location implements ILocation {
  constructor(public filepath, public lineno) {}
}


type TBlockOrTestStats = ITestStats | IBlockStats

export enum TestStatus {
  Passed,
  Failed,
  Skipped,
  NotRun,
}

export interface ITestStats {
  output: IConsoleOutput[]
  beforeEachOutput: IConsoleOutput[]
  afterEachOutput: IConsoleOutput[]
  status: TestStatus
  time: number
  error?: Error
  item: IItem
  depth?: number
  type: string
}

export class TestStats {
  output = []
  beforeEachOutput = []
  afterEachOutput = []
  status = TestStatus.NotRun
  time = 0
  error = null
  depth = 0
  type = "test"
  constructor(public item){}
}

export enum ConsoleOutputType {
  Warn,
  Error,
  Log
}

export interface IConsoleOutput {
  type: ConsoleOutputType
  message: string[]
  location: ILocation
}

export interface IBlockStats {
  passed: ITestStats[]
  failed: ITestStats[]
  skipped: ITestStats[]
  totalRun: number
  depth: number
  children: TBlockOrTestStats[]
  block: IBlock
  time: number
  beforeOutput: IConsoleOutput[]
  afterOutput: IConsoleOutput[]
  wasRun: boolean
  output: IConsoleOutput[]
  type: string
}

export class BlockStats implements IBlockStats {
  passed = []
  failed = []
  totalRun = 0
  children = []
  time = 0
  beforeOutput = []
  afterOutput = []
  output = []
  skipped = []
  wasRun = false
  type = "block"
  constructor(public block, public depth, public name){}
}

export interface IRunOptions {
  callbacks: IRunCallbacks
  outputConsole: boolean
}

export class RunOptions implements IRunOptions {
  public callbacks = new RunCallbacks
  public outputConsole = false
  constructor(options = {}) {
    Object.assign(this, options)
  }
}


export async function run(block: IBlock, inskip = false, depth = 0, options = new RunOptions, name?: string) {
  const mp = monkeyPatchConsole(options)
  const {
    children,
    beforeEaches,
    afterEaches,
    befores,
    afters,
    containsOnly,
  } = block
  const {callbacks} = options
  const stats = new BlockStats(block, depth, name)
  try {
    if (containsOnly) {
      for (const before of befores) {
        if (callbacks.before) {
          callbacks.before(block, inskip, depth)
        }
        const dispose = mp.setConsoleOutput(stats.beforeOutput)
        await before()
        dispose()
      }
    }
    for (const item of children) {
      if (item instanceof Describe) {
        const skip = (inskip || (containsOnly && !item.block.containsOnly))
        const timeStart = +new Date
        const itemStats = await run(item.block, skip, depth+1, options, item.name)
        const timeEnd = +new Date
        itemStats.time = timeStart - timeEnd
        itemStats.wasRun = skip
        stats.totalRun += itemStats.totalRun
        stats.passed.push(...itemStats.passed)
        stats.failed.push(...itemStats.failed)
        stats.skipped.push(...itemStats.skipped)
        stats.children.push(itemStats)
      } else if (item instanceof Test) {
        const testStats = new TestStats(item)
        testStats.depth = depth
        if (callbacks.beforeTest) {"./"
          callbacks.beforeTest(item, depth)
        }
        let destroy, destroyPromiseMp;
        try {
          stats.children.push(testStats)
          if ((!item.only) && (containsOnly || inskip || item.skip)) {
            stats.skipped.push(testStats)
          testStats.status = TestStatus.Skipped
            continue
          }
          for (const beforeEach of beforeEaches) {
            const destroy = mp.setConsoleOutput(testStats.beforeEachOutput)
            await beforeEach()
            destroy()
          }
          destroy = mp.setConsoleOutput(testStats.output)
          destroyPromiseMp = monkeyPatchPromise()

          const timeoutMsg = `'${item.name}' timed out.`
          let hasResolved = false
          await Promise.race([
            item.fn().then(()=> hasResolved = true),
            timeout(3000).then(() => timeoutMsg)
          ])
          if (!hasResolved) {
            throw new Error(timeoutMsg)
          }

          allPromises = []
          destroy()
          destroyPromiseMp()

          // doesn't work, but need a way to check
          // for unresolved promises in the future

          // const ap = allPromises
          // allPromises = []
          // destroy()
          // destroyPromiseMp()

          // let timedout = false
          // const checkProms = proms => {
          //   if (!timedout) {
          //     return
          //   }
          //   if (proms instanceof Error) {
          //     return actualWarn(`Unawaited promises errored in '${item.name}'`)
          //   }
          //   const unAwaited = proms
          //     .filter(Boolean)
          //     .filter(item => item !== timeoutMsg)
          //   if (unAwaited.length) {
          //     actualWarn(`Unawaited promises found in '${item.name}'`)
          //   }
          // }
          // Promise
          //   .all(ap)
          //   .then(checkProms)
          //   .catch(checkProms)


          // timeout(1).then(() => {
          //   timedout = true
          // })

          for (const afterEach of afterEaches) {
            const destroy = mp.setConsoleOutput(testStats.afterEachOutput)
            await afterEach()
            destroy()
          }
          stats.passed.push(item)
          testStats.status = TestStatus.Passed
        } catch (err) {
          // TODO separate errors for afters, befores, and durings
          // might still want to run "afterEach" even on failure
          destroy()
          destroyPromiseMp()
          testStats.error = err
          // testStats.warnings
          stats.failed.push(testStats)
          testStats.status = TestStatus.Failed
        }
        if (callbacks.afterTest) {
          callbacks.afterTest(testStats, item)
        }
        stats.totalRun++
      }
    }
    if (containsOnly) {
      for (const after of afters) {
        const destroy = mp.setConsoleOutput(stats.afterOutput)
        await after()
        destroy()
        if (callbacks.after) {
          callbacks.after(stats)
        }
      }
    }
  } catch (e) {
    console.error(e)
  }
  mp()

  return stats
}

const noop = (...args) => {}
function monkeyPatchConsole(options) {
  let prevConsoleLog = console.log
  let prevConsoleWarn = console.warn
  let prevConsoleError = console.error
  let onConsoleWarn = noop
  let onConsoleLog = noop
  let onConsoleError = noop
  console.log = (...args) => {
    onConsoleLog(...args)
    if (options.outputConsole) {
      prevConsoleLog(...args)
    }
  }
  console.warn = (...args) => {
    onConsoleWarn(...args)
    if (options.outputConsole) {
      prevConsoleWarn(...args)
    }
  }
  console.error = (...args) => {
    onConsoleError(...args)
    if (options.outputConsole) {
      prevConsoleError(...args)
    }
  }
  const dispose = () => {
    console.log = prevConsoleLog
    console.warn = prevConsoleWarn
    console.error = prevConsoleError

  }
  dispose.setConsoleOutput = setConsoleOutput
  return dispose

  function setConsoleOutput(outputArr) {
    const prevOnConsoleWarn = onConsoleWarn
    onConsoleWarn = (...args) => {
      outputArr.push({
        message: args.map(String),
        location: getLocation(/Object.console\.warn/),
        type: ConsoleOutputType.Warn
      })
    }
    const prevOnConsoleError = onConsoleError
    onConsoleError = (...args) => {
      outputArr.push({
        message: args.map(String),
        location: getLocation(/Object.console\.error/),
        type: ConsoleOutputType.Error
      })
    }
    const prevOnConsoleLog = onConsoleLog
    onConsoleLog = (...args) => {
      outputArr.push({
        message: args.map(String),
        location: getLocation(/Object.console\.log/),
        type: ConsoleOutputType.Log
      })
    }
    return () => {
      onConsoleWarn = prevOnConsoleWarn
      onConsoleError = prevOnConsoleError
      onConsoleLog = prevOnConsoleLog
    }
  }
}

let allPromises: any[] = []
const NormalPromise:any = global.Promise
function monkeyPatchPromise() {
  ;(global as any).Promise = class Promise extends NormalPromise {
    constructor(...props) {
      super(...props)
      allPromises.push(this)
    }
  }
  return () => {
    ;(global as any).Promise = NormalPromise
    allPromises = []
  }
}

export function getLocation(matchLine, last=false): ILocation {
  require('source-map-support/register')
  const {stack} = new Error()
  const lines = stack
    .split('\n')
  if (last) {
    maybeLog = lines
  }

  const lineIndex = lines.findIndex(line => matchLine.test(line))

  const fileLine = lines[lineIndex + 1]
  const [_, filepath, lineno] = /.*\s\(?([^:]+):(\d+):\d+\)?$/.exec(fileLine)
  return {
    filepath,
    lineno,
  }
}

function timeout(ms) {
	return new NormalPromise(resolve => setTimeout(resolve, ms));
}
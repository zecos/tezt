import uuid from 'uuid/v4'
import { RunCallbacks, IRunCallbacks } from './RunCallbacks';


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
  location = (() => {
    return getLocation(/tezt\.singleton\.ts/)
  })()
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
    return await run(this.curBlock)
  }

  public only = () => {
    this.onlyLocations.push(getLocation(new RegExp("")))
  }

  public skip = () => {
    this.skipLocations.push(getLocation(new RegExp("")))
  }

  public before     = fn => this.curBlock.befores.push(fn)
  public beforeEach = fn => this.curBlock.beforeEaches.push(fn)
  public after      = fn => this.curBlock.afters.push(fn)
  public afterEach  = fn => this.curBlock.afterEaches.push(fn)
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
}

export class TestStats {
  output = []
  beforeEachOutput = []
  afterEachOutput = []
  status = TestStatus.NotRun
  time = 0
  error = null
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
        if (callbacks.beforeTest) {"./"
          callbacks.beforeTest(item, depth)
        }
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
          const destroy = mp.setConsoleOutput(testStats.output)
          await item.fn()
          destroy()
          for (const afterEach of afterEaches) {
            const destroy = mp.setConsoleOutput(testStats.afterEachOutput)
            await afterEach()
            destroy()
          }
          stats.passed.push(item)
          testStats.status = TestStatus.Passed
        } catch (e) {
          testStats.error = e
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

export function getLocation(matchLine): ILocation {
  require('source-map-support/register')
  const {stack} = new Error()
  const lines = stack
    .split('\n')
  const lineindex = lines.findIndex(line => matchLine.test(line))
  const fileline = lines[lineindex + process.env.TEZT === "cli" ? 2 : 1]
  const [_, filepath, lineno] = /.*\s\(?([^:]+):(\d+):\d+\)?$/.exec(fileline)
  return {
    filepath,
    lineno,
  }
}

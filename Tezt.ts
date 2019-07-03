import uuid from 'uuid/v4'
import chalk from 'chalk';
import { RunCallbacks, IRunCallbacks } from './output';
import { timingSafeEqual } from 'crypto';


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
  location = getLocation()
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
    this.onlyLocations.push(getLocation())
  }

  public skip = () => {
    this.skipLocations.push(getLocation())
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

export function getLocation(depth = 3): ILocation {
  const {stack} = new Error()
  const lines = stack.split('\n')
  const fileLine = lines[depth]
  const filepath = /\(([^:]+):/.exec(fileLine)[1]
  const lineno = /:(\d+):/.exec(fileLine)[1]
  return {
    filepath,
    lineno,
  }
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
}

export class TestStats {
  output = []
  beforeEachOutput = []
  afterEachOutput = []
  status = TestStatus.NotRun
  time = 0
  error = null
}

export interface IBlockStats {
  passed: ITest[]
  failed: ITest[]
  totalRun: number
  depth: number
  children: TBlockOrTestStats[]
  block: IBlock
  time: number
  skipped: boolean
  beforeOutput: IConsoleOutput[]
  afterOutput: IConsoleOutput[]
  output: IConsoleOutput[]
}

enum ConsoleOutputType {
  Warn,
  Error,
  Log
}

export interface IConsoleOutput {
  type: ConsoleOutputType
  message: string[]
  location: ILocation
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
  constructor(public block, public depth, public skipped){}
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


export function outputResults (stats) {
  const { passed, totalRun, totalTests, failed } = stats
  console.log(chalk.cyanBright(`${passed} / ${totalRun} passed`))
  console.log(chalk.cyan(`${totalTests - totalRun} skipped`))
  failed.forEach(name => console.log(chalk.red(`FAILED: ${name}`)))
}

export async function run(block: IBlock, inskip = false, depth = 0, options = new RunOptions) {
  let prevConsoleLog = console.log
  let prevConsoleWarn = console.warn
  let prevConsoleError = console.error
  let onConsoleWarn = (...args) => {}
  let onConsoleLog = (...args) => {}
  let onConsoleError = (...args) => {}
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
  const {children, beforeEaches, afterEaches, befores, afters, containsOnly} = block
  const {callbacks} = options
  const stats = new BlockStats(block, depth, inskip)
  try {
    if (containsOnly) {
      for (const before of befores) {
        if (callbacks.before) {
          callbacks.before(block, inskip, depth)
        }
        const destroy = setConsoleOutput(stats.beforeOutput)
        await before()
        destroy()
      }
    }
    for (const item of children) {
      if (item instanceof Describe) {
        const skip = (inskip || (containsOnly && !item.block.containsOnly))
        const timeStart = +new Date
        const itemStats = await run(item.block, skip, depth+1, options)
        const timeEnd = +new Date
        itemStats.time = timeStart - timeEnd
        stats.children.push(itemStats)
      } else if (item instanceof Test) {
        const testStats = new TestStats
        if (callbacks.beforeTest) {
          callbacks.beforeTest(item, depth)
        }
        try {
          stats.children.push(testStats)
          if ((!item.only) && (containsOnly || inskip || item.skip)) {
            stats.skipped.push(item)
            continue
          }
          for (const beforeEach of beforeEaches) {
            const destroy = setConsoleOutput(testStats.beforeEachOutput)
            await beforeEach()
            destroy()
          }
          const destroy = setConsoleOutput(testStats.output)
          await item.fn()
          destroy()
          for (const afterEach of afterEaches) {
            const destroy = setConsoleOutput(testStats.afterEachOutput)
            await afterEach()
            destroy()
          }
          stats.passed.push(item)
        } catch (e) {
          testStats.error = e
          stats.failed.push(item)
        }
        if (callbacks.afterTest) {
          callbacks.afterTest(testStats, item)
        }
        stats.totalRun++
      }
    }
    if (containsOnly) {
      for (const after of afters) {
        const destroy = setConsoleOutput(stats.afterOutput)
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
  return stats

  function setConsoleOutput(outputArr) {
    const prevOnConsoleWarn = onConsoleWarn
    onConsoleWarn = (...args) => {
      outputArr.push({
        message: args.map(String),
        location: getLocation(),
        type: ConsoleOutputType.Warn
      })
    }
    const prevOnConsoleError = onConsoleError
    onConsoleError = (...args) => {
      outputArr.push({
        message: args.map(String),
        location: getLocation(),
        type: ConsoleOutputType.Error
      })
    }
    const prevOnConsoleLog = onConsoleLog
    onConsoleLog = (...args) => {
      outputArr.push({
        message: args.map(String),
        location: getLocation(),
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
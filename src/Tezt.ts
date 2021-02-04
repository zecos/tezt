import uuid from 'uuid/v4'
import { RunCallbacks, IRunCallbacks } from './RunCallbacks';
import { monkeyPatchConsole, IConsoleOutput, ILocation, getLocation } from './patch';

type AnyFunc = (...args) => any | void

const blankTrap = ():ITrapData => ({
  output: [],
  error: null
})

const globalAny: any = global
const log = console.log
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
    getLocation(/tezt\.singleton\.(t|j)s/)
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
  isRunning = false
  timeout = 5000


  constructor() {
    super()
    this.curAncestors.push(this)
    this.curBlock = this.block
  }

  public test = (() => {
    const test = (name, fn) => {
      if (typeof name !== "string") {
        throw new Error("The first argument to `test` must be a string, got " + name)
      }
      if (typeof fn !== "function") {
        console.error('Error in ' + name)
        throw new Error("The second argument to `test` must be a function, got " + fn)
      }
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
    const results = await this.runBlock(this.curBlock)
    for (const afterAll of this.afterAlls) {
      await afterAll()
    }
    return results
  }

  public runBlock = async (
      block: IBlock,
      inskip = false,
      depth = 0,
      options = new RunOptions,
      name?: string
  ) => {
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
    const runBlockMulti = async (aux, fnName) => {
      for (const {fn, location} of aux) {
        stats[`${name}Trap`]
          .push({
            location,
            trap: await trapRun(fn, {
              name: `${name}.${fnName}`,
              timeout: this.timeout,
              outputConsole: options.outputConsole
            })
          })

      }
    }
    if (containsOnly) {
      await runBlockMulti(befores, 'before')
    }
    for (const item of children) {
      if (item instanceof Describe) {
        const skip = (inskip || (containsOnly && !item.block.containsOnly))
        const timeStart = +new Date
        const itemStats = await this.runBlock(
            item.block,
            skip,
            depth+1,
            options,
            item.name
        )
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
        if (callbacks.beforeTest) {
          callbacks.beforeTest(item, depth)
        }
        stats.children.push(testStats)
        if ((!item.only) && (containsOnly || inskip || item.skip)) {
          stats.skipped.push(testStats)
          testStats.status = TestStatus.Skipped
          continue
        }
        const runMulti = async (aux, name) => {
          for (const {fn, location} of aux) {
            testStats[`${name}Trap`]
              .push({
                location,
                trap: await trapRun(fn, {
                  name: `${item.name}.${name}`,
                  timeout: this.timeout,
                  outputConsole: options.outputConsole
                })
              })
          }
        }
        await runMulti(globalAny.globalBeforeEaches, 'globalBeforeEach')
        await runMulti(beforeEaches, 'beforeEach')

        testStats.trap = await trapRun(item.fn, {
          name: item.name,
          outputConsole: options.outputConsole,
          timeout: this.timeout,
        })
        if (testStats.trap.error) {
          stats.failed.push(testStats)
          testStats.status = TestStatus.Failed
        } else {
          stats.passed.push(item)
          testStats.status = TestStatus.Passed
        }
        await runMulti(afterEaches, 'afterEach')
        await runMulti(globalAny.globalAfterEaches, 'globalAfterEach')

        if (callbacks.afterTest) {
          callbacks.afterTest(testStats, item)
        }
        stats.totalRun++
      }
    }
    if (containsOnly) {
      await runBlockMulti(afters, 'after')
    }

    return stats
  }

  public only = () => {
    this.onlyLocations.push(new RegExp(""))
  }

  public skip = () => {
    this.skipLocations.push(new RegExp(""))
  }

  private addItem = (itemType: string) => (fn: AnyFunc) => {
    const location = getLocation(/tezt\.singleton\.(t|j)s/)
    this.curBlock[itemType].push({
      fn,
      location,
    })
  }
  public before     = this.addItem("befores")
  public beforeEach = this.addItem("beforeEaches")
  public beforeAll  = this.addItem("beforeAlls")
  public after      = this.addItem("afters")
  public afterEach  = this.addItem("afterEaches")
  public afterAll   = this.addItem("afterAlls")
}

type TBlockOrTestStats = ITestStats | IBlockStats

export enum TestStatus {
  Passed,
  Failed,
  Skipped,
  NotRun,
}

export interface ITestStats {
  beforeEachTrap: ITrapData[]
  afterEachTrap: ITrapData[]
  globalBeforeEachTrap: ITrapData[]
  globalAfterEachTrap: ITrapData[]
  trap: ITrapData
  status: TestStatus
  time: number
  item: IItem
  depth?: number
  type: string
}

export class TestStats implements ITestStats{
  beforeEachTrap = []
  afterEachTrap = []
  globalBeforeEachTrap = []
  globalAfterEachTrap = []
  trap = blankTrap()

  status = TestStatus.NotRun
  time = 0
  depth = 0
  type = "test"
  constructor(public item){}
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
  beforeTrap: ITrapData[]
  afterTrap: ITrapData[]
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
  beforeTrap = []
  afterTrap = []
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

interface ITrapOptions {
  name: string
  outputConsole: boolean
  timeout: number
}

export interface ITrapData {
  output: IConsoleOutput[]
  error: Error
}

async function trapRun(fn: (...args) => any, options: ITrapOptions) {
  const result = blankTrap()
  const mp = monkeyPatchConsole(options)
  const destroy = mp.setConsoleOutput(result.output)
  try {
    let noTimeout = false
    let running = fn()
    ;(global as any).$$teztSingleton.isRunning = true
    // in case there are exceptions in callbacks
    let uncaughtErr, uncaughtRej;
    const uncaughtPromise = new Promise((res, rej) => {
      uncaughtRej = rej
    })
    const handleUncaught = err => {
      console.error(`There was an uncaught exception`)
      noTimeout = true
      uncaughtRej(err)
    }
    process.on('uncaughtException', handleUncaught)
    if (isPromise(running)) {
      await Promise.race([
        running
          .then(()=> {
            noTimeout = true
          }),
        timeout(this.timeout),
        uncaughtPromise,
      ])
      if (!noTimeout) {
        throw new Error(`'${options.name || 'function'}' timed out.`)
      }
    }
    ;(global as any).$$teztSingleton.isRunning = false
    process.off('uncaughtException', handleUncaught)
    if (uncaughtErr) {
      throw uncaughtErr
    }
  } catch (err) {
    result.error = err
  }
  destroy()
  return result
}

const NormalPromise:any = global.Promise
function timeout(ms) {
	return new NormalPromise(resolve => setTimeout(resolve, ms));
}

function isPromise(p) {
  return p && Object.prototype.toString.call(p) === "[object Promise]";
}
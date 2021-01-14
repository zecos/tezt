import chalk from "chalk";
import {TVoidFunc, TestStatus} from './Tezt'
import { Stats } from "fs";

export interface IRunCallbacks {
  before: (block, skip, depth) => void
  after?: (stats) => void
  beforeTest?: (item, depth) => void
  afterTest?: (testStats, item) => void
}

const callbackNames = [
  'before',
  'after',
  'beforeTest',
  'afterTest'
]

export class RunCallbacks implements IRunCallbacks {
  before = (block, inskip, depth) => {}
  after = (stats) => {}
  beforeTest = (item, depth) => {}
  afterTest = (testStats, item) => {}

  constructor(callbacks = {}) {
    for (const name in callbacks) {
      if (!callbackNames.includes(name)) {
        throw new Error('There is not callback of type ' + name)
      }
    }
    Object.assign(this, callbacks)
  }
}

export const classicCallbacks =  new RunCallbacks({
  before: (item, stats) => {
    console.log(chalk.cyan(`${"#".repeat(stats.depth)} ${item.name}`))
  },
  after: stats => {
    console.log()
  },
  beforeTest: (item, depth) => {
    console.log(chalk.magenta(`${"#".repeat(depth)} Running ${item.name}`))
  },
  afterTest: (stats, item) => {
    if (stats.Status === TestStatus.Failed) {
      console.error(item.name, chalk.red('FAILED :('))
    } else if (stats.Status === TestStatus.Passed) {
      console.log(chalk.green(`PASSED ✓ ${item.name}\n`))
      console.error(chalk.red(stats.error.stack))
    }
  }
})
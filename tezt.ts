import chalk from 'chalk';
import uuid from 'uuid/v4'
import 'source-map-support/register'


let curOnlys = []
let curItems = []
let curAfters = []
let curBefores = []

const IN_MOCHA = typeof global.it !== "undefined" && typeof global.test ==="undefined" && process.argv.some(name => /mocha/.test(name))
const IN_JEST = typeof global.test !== "undefined" && !IN_MOCHA
const IN_MOCHA_OR_JEST = IN_JEST || IN_MOCHA

export const test:any = IN_MOCHA ? global.it : IN_JEST ? global.test : teztTest
function teztTest(name, fn, id?: string) {
  id = id || uuid()
  const test = {
    name,
    fn,
    id,
    type: 'test',
  }
  curItems.push(test)
}

if (!IN_MOCHA_OR_JEST) {
  test.skip = (name?, fn?) => {}
  test.only = (name, fn) => {
    const id = uuid()
    curOnlys.push(id)
    test(name, fn, id)
  }
}

export const describe:any = IN_MOCHA_OR_JEST ? global.describe : teztDescribe
function teztDescribe(name, fn, id?) {
  id = id || uuid()
  const onlys = []
  const items = []
  const befores = []
  const afters = []
  const describe = {
    name,
    id,
    onlys,
    items,
    afters,
    befores,
    type: "describe",
  }
  curItems.push(describe)

  const prevCurItems = curItems
  const prevOnlys = curOnlys
  const prevBefores = curBefores
  const prevAfters = curAfters
  curOnlys = onlys
  curItems = items
  curBefores = befores
  curAfters = afters
  fn()
  curItems = prevCurItems
  curOnlys = prevOnlys
  curBefores = prevBefores
  curAfters = prevAfters
}

if (!IN_MOCHA_OR_JEST) {
  describe.only = (name, fn) => {
    const id = uuid()
    curOnlys.push(id)
    describe(name, fn, id)
  }
  describe.skip = (name?, fn?) => {}
}

let depth = 0
const failed = []
export async function runTests(items, onlys) {
  depth++
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (onlys.length && !onlys.includes(item.id)) continue
    if (item.type === "test") {
      try {
        console.log(chalk.magenta(`${"#".repeat(depth)} Running ${item.name}`))
        await item.fn()
        passed++
        console.log(chalk.green(`PASSED ✓ ${item.name}`))
      } catch (e) {
        failed.push(item.name)
        console.error(chalk.red(e.stack))
        console.error(item.name, chalk.red('FAILED :('))
      }
      total++
    } else if (item.type === "describe") {
      console.log(chalk.cyan(`${"#".repeat(depth)} ${item.name.toUpperCase()}`))
      for (let i = 0; i < item.befores.length; i++) {
        try {
          await item.befores[i]()
        } catch (e) {
          console.error(e)
        }
      }
      await runTests(item.items, item.onlys)
      for (let i = 0; i < item.afters.length; i++) {
        try {
          await item.afters[i]()
        } catch (e) {
          console.error(e)
        }
      }
    }
  }
  depth++
}

export const after = IN_MOCHA ? (global as any).after : IN_JEST ? (global as any).afterAll : teztAfter
function teztAfter (fn) {
  curAfters.push(fn)
}
export const before = IN_MOCHA ? (global as any).before : IN_JEST ? (global as any).beforeAll : teztBefore
function teztBefore(fn) {
  curBefores.push(fn)
}

export const log = (...args) => {
  const err = new Error()
  const fileNameRegex = /\(.*\)/g
  const match = fileNameRegex.exec(err.stack.split('\n')[2])
  console.log(chalk.cyan(match[0].slice(1, match[0].length - 1)))
  console.log(...args)
}

let hasRun = false
let passed = 0
let total = 0
process.on('beforeExit', async () => {
  if (!hasRun && !IN_MOCHA_OR_JEST) {
    hasRun = true
    for (let i = 0; i < curBefores.length; i++) {
      try {
        await curBefores[i]()
      } catch (e) {
        console.error(e)
      }
    }
    await runTests(curItems, curOnlys)
    console.log(chalk.cyanBright(`${passed} / ${total} passed`))
    failed.forEach(name => console.log(chalk.red(`${name} FAILED`)))
    for (let i = 0; i < curAfters.length; i++) {
      try {
        await curAfters[i]()
      } catch (e) {
        console.error(e)
      }
    }
  }
})
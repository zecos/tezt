import chalk from "chalk";
import path from 'path'

import { TestStatus, ITrapData } from './Tezt';
import { ConsoleOutputType } from './patch'

export function outputResults (stats) {
  const { passed, totalRun, failed, skipped } = stats
  outputContent(stats)
  const totalTests = passed.length + failed.length + skipped.length
  const failedMsg = chalk.red(`${failed.length} failed`)
  const skippedMsg = chalk.yellow(`${skipped.length} skipped`)
  const passedMsg = chalk.green(`${passed.length} passed`)
  const totalMsg = `${totalTests} total`
  console.log()
  console.log(`Tests: ${failedMsg}, ${skippedMsg}, ${passedMsg}, ${totalMsg}, ${totalRun} run`)
  const failedAuxiliary = getFailedAuxiliary(stats)
  failed.forEach(stats => {
    const {location, name} = stats.item
    const relativepath = path.relative(process.cwd(), location.filepath)
    const locationinfo = chalk.red.dim(`  (./${relativepath}:${location.lineno})`)
    console.log(chalk.red(`FAILED: ${name} ${locationinfo}`))
    const errorMsg = stats.error.stack.split('\n')
      .map(line => chalk.red(`  ${line}`)).join("\n")
    console.log(errorMsg)
  })
}


const precursors = {
  [TestStatus.Passed]: chalk.green("✓ "),
  [TestStatus.Failed]: chalk.red("✕ "),
  [TestStatus.Skipped]: chalk.yellow("○") + " skipped "
}

function outputContent(stats) {
  const {depth} = stats
  logoutputs(stats.beforeTrap.output, depth)
  for (const itemStats of stats.children) {
    if (itemStats.type === "block") {
      const indentation = "  ".repeat(depth)
      console.log(`${indentation}# ${itemStats.name}`)
      outputContent(itemStats)
    } else if (itemStats.type === "test") {
      const {item, status, depth} = itemStats
      const {name} = item
      const precursor = precursors[status]
      const indentation = "  ".repeat(depth)
      const { location } = itemStats.item
      const relativepath = path.relative(process.cwd(), location.filepath)
      const locationinfo = chalk.dim(`  (./${relativepath}:${location.lineno})`)
      console.log(`${indentation}${precursor}${name}${locationinfo}`)
      logoutputs(itemStats.globalBeforeEachTrap, depth+1)
      logoutputs(itemStats.beforeEachTrap, depth+1)
      logoutputs(itemStats.trap, depth+1)
      logoutputs(itemStats.afterEachTrap, depth+1)
      logoutputs(itemStats.globalAfterEachTrap, depth+1)
    }
  }
  logoutputs(stats.afterTrap.output, depth)
}





export function outputCompositeResults(compositeStats) {
  const results = {
    failed: 0,
    skipped: 0,
    passed: 0,
  }
  for (const stats of compositeStats) {
    results.failed += stats.failed.length
    results.skipped += stats.skipped.length
    results.passed += stats.passed.length
  }
  const totalTests = results.passed + results.failed + results.skipped
  const failedMsg = chalk.red(`${results.failed} failed`)
  const skippedMsg = chalk.yellow(`${results.skipped} skipped`)
  const passedMsg = chalk.green(`${results.passed} passed`)
  const totalMsg = `${totalTests} total`
  console.log()
  console.log(`Composite Results: ${failedMsg}, ${skippedMsg}, ${passedMsg}, ${totalMsg}`)
}

function getFailedAuxiliary(stats) {
  let errors = []
  if (stats.beforeTrap.error) {
    errors.push(stats.beforeTrap)
  }
  for (const itemStats of stats.children) {
    if (itemStats.type === "block") {
      errors = errors.concat(getFailedAuxiliary(itemStats))
    } else if (itemStats.type === "test") {
      errors.push(itemStats.trap)
      errors.push(itemStats.globalBeforeEachTrap.trap)
      errors.push(itemStats.beforeEachTrap.trap)
      errors.push(itemStats.afterEachTrap.trap)
      errors.push(itemStats.globalAfterEachTrap.trap)
    }
  }
  logoutputs(stats.afterTrap)
}

function logoutputs(trapData: ITrapData, depth=0) {
  const indentation = "  ".repeat(depth)
  for (const output of trapData.output) {
    const { location, type, message } = output
    const relativepath = path.relative(process.cwd(), location.filepath)
    const locationinfo = `  (./${relativepath}:${location.lineno})`
    const formattedOutput = `${indentation}${message.join(" ")}${locationinfo}`
    if (type === ConsoleOutputType.Warn) {
      console.log(chalk.yellow.dim(formattedOutput))
    } else if (output.type === ConsoleOutputType.Error) {
      console.log(chalk.red.dim(formattedOutput))
    } else if (output.type === ConsoleOutputType.Log) {
      console.log(chalk.dim(formattedOutput))
    }
  }
}
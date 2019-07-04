import chalk from "chalk";
import path from 'path'

import { BlockStats, TestStats, ConsoleOutputType, TestStatus } from './Tezt';

export function outputResults (stats) {
  const { passed, totalRun, failed, skipped } = stats
  outputContent(stats)
  const totalTests = passed.length + failed.length + skipped.length
  const failedMsg = chalk.red(`${failed.length} failed`)
  const skippedMsg = chalk.yellow(`${skipped.length} skipped`)
  const passedMsg = chalk.green(`${passed.length} passed`)
  const totalMsg = `${totalTests} total`
  console.log()
  console.log(`Tests: ${failedMsg}, ${skippedMsg}, ${passedMsg}, ${totalMsg}`)
  console.log(`Total: ${totalRun}`)
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
  logoutputs(stats.beforeOutput, depth)
  for (const itemStats of stats.children) {
    if (itemStats instanceof BlockStats) {
      const indentation = "  ".repeat(depth)
      console.log(`${indentation}# ${itemStats.name}`)
      outputContent(itemStats)
    } else if (itemStats instanceof TestStats) {
      const {item, status} = itemStats
      const {depth, name} = item
      const precursor = precursors[status]
      const indentation = "  ".repeat(depth)
      const { location } = itemStats.item
      const relativepath = path.relative(process.cwd(), location.filepath)
      const locationinfo = chalk.dim(`  (./${relativepath}:${location.lineno})`)
      console.log(`${indentation}${precursor}${name}${locationinfo}`)
      logoutputs(itemStats.beforeEachOutput, depth+1)
      logoutputs(itemStats.output, depth+1)
      logoutputs(itemStats.afterEachOutput, depth+1)
    }
  }
  logoutputs(stats.afterOutput, depth)
}



function logoutputs(outputs, depth) {
  const indentation = "  ".repeat(depth)
  for (const output of outputs) {
    const { location, type, message } = output
    const relativepath = path.relative(process.cwd(), location.filepath)
    const locationinfo = `  (./${relativepath}:${location.lineno})`
    const _output = `${indentation}${message.join(" ")}${locationinfo}`
    if (type === ConsoleOutputType.Warn) {
      console.log(chalk.yellow.dim(_output))
    } else if (output.type === ConsoleOutputType.Error) {
      const output = indentation + message.join(" ")
      console.log(chalk.red.dim(_output))
    } else if (output.type === ConsoleOutputType.Log) {
      const output = indentation + message.join(" ")
      console.log(chalk.dim(_output))
    }
  }
}
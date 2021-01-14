#!/usr/bin/env node

import chalk from 'chalk';
import glob from 'glob-promise'
import chokidar from 'chokidar'
import uuid from 'uuid/v4'
import fs from 'fs-extra'
import { Tezt } from './Tezt';
import {getConfig} from './config'
import { outputResults } from './output';
import path from 'path'
import ('source-map-support/register')

process.env.TEZT = "cli"
process.env.FORCE_COLOR = process.env.FORCE_COLOR || "1"
async function main() {
  const config = await getConfig()
  if (!config.watch) {
    return await runTests(config)
  }

  let running = false
  chokidar
    .watch([config.watchPatterns, config.testPatterns], {
      ignored: config.ignorePatterns,
      ignoreInitial: false,
    })
    .on('all', async (...args) => {
      if (!running) {
        running = true
        setTimeout(async () => {
          await runTests(config)
          running = false
        }, 500)
      }
    })
    .on('ready', () => {
      console.log(chalk.cyan('Watching for changes...'))
    })
}

async function runTests(config) {
  const allTestFiles = await getAllTestFiles(config)
  const requireKeep = Object.keys(require.cache)
  const compositeStats: any[] = []
  for (const file of allTestFiles) {
    await import('source-map-support/register')
    await import('ts-node/register')
    console.log()
    console.log(chalk.bold(`File: ${file}`))
    await import(path.resolve(process.cwd(), file))
    const stats = await (global as any).$$tezt.run()
    compositeStats.push(stats)
    outputResults(stats)
  }
  if (allTestFiles.length > 1) {
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
  reset()
  function reset() {
    ;(global as any).$$tezt = new Tezt
    if(config.watch) {
      resetRequire(requireKeep)
    }
  }
}

function resetRequire(requireKeep) {
  for (const key in require.cache) {
    if (!requireKeep.includes(key)) {
      delete require.cache[key]
    }
  }
}

async function getAllTestFiles(config) {
  let files: string[] = []
  for (const testPath of config.testPaths) {
    if (!fs.existsSync(testPath)) {
      console.error(`Could not find ${testPath}`)
      process.exit(1)
    }
    const stats  = await fs.lstat(testPath)
    if (stats.isFile()) {
      files.push(testPath)
      continue
    }
    const globFiles = await glob(config.testPatterns, {
      cwd: testPath,
      root: config.root || process.cwd(),
      ignore: config.ignorePatterns,
    })
    files = files.concat(globFiles.map(file => (
      path.relative(process.cwd(), path.resolve(testPath, file))
    )))
  }
  return files
}

;(async () => {
  try {
    await main()
  } catch(e) {
    console.error(e)
  }
})()

function debounce(func, wait, immediate) {
	var timeout
	return async function(...args) {
		var later = async function() {
			timeout = null
			if (!immediate) await func(...args)
    }
		var callNow = immediate && !timeout
		clearTimeout(timeout)
		timeout = setTimeout(later, wait)
		if (callNow) await func(...args)
	}
}
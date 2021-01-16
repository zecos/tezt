#!/usr/bin/env node

import chalk from 'chalk';
import glob from 'glob-promise'
import chokidar from 'chokidar'
import fs from 'fs-extra'
import {getConfig} from './config'
import { reset as singletonReset } from './tezt.singleton'
import { outputCompositeResults, outputResults } from './output';
import path from 'path'
import ('source-map-support/register')

process.env.TEZT = "cli"
process.env.FORCE_COLOR = process.env.FORCE_COLOR || "1"
const globalAny: any = global as any
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
          try {
            await runTests(config)
          } catch (err) {
            console.error('There was a compilation error')
            console.error(err)
          }
          running = false
        }, 500)
      }
    })
    .on('ready', () => {
      console.log(chalk.cyan('Watching for changes...'))
    })
}

async function runTests(config) {
  if (!config.root) {
    console.error('You must run this from within a node project (with a package.json)')
    process.exit(1)
  }
  if (!fs.existsSync(config.root)) {
    console.error(`Project root, ${config.root}, does not exist.`)
    process.exit(1)
  }
  if (!fs.existsSync(path.resolve(config.root, 'package.json'))) {
    console.warn(`package.json not found in ${config.root}`)
  }
  if (!fs.existsSync(path.resolve(config.root, 'node_modules', 'tezt'))) {
    console.error(`Local tezt package not found. Please install:`)
    let yarnCwdArg = ''
    if (config.root !== process.cwd()) {
      yarnCwdArg = '--cwd ' + config.root
    }
    console.log(`yarn add ${yarnCwdArg} --dev tezt`)
    console.log('or')
    if (config.root !== process.cwd()) {
      console.log(`(cd ${config.root} && npm install --save-dev tezt)`)
    } else {
      console.log(`npm install --save-dev tezt`)
    }
  }

  const allTestFiles = await getAllTestFiles(config)
  console.log(config)
  console.log({allTestFiles})
  const requireKeep = Object.keys(require.cache)

  const tezts: any[] = []
  globalAny.globalAfterAlls = []
  globalAny.globalBeforeAlls = []
  for (const file of allTestFiles) {
    singletonReset()
    await import('source-map-support/register')
    await import('ts-node/register')
    globalAny.$$tezt.file = file
    await import(path.resolve(process.cwd(), file))
    tezts.push(globalAny.$$tezt)
  }

  const compositeStats: any[] = []
  for (const fn of globalAny.globalBeforeAlls) {
    await fn()
  }
  for (const tezt of tezts) {
    console.log(chalk.bold(`File: ${tezt.file}`))
    const stats = await tezt.run()
    outputResults(stats)
    compositeStats.push(stats)
    console.log()
  }
  for (const fn of globalAny.globalAfterAlls) {
    await fn()
  }

  if (allTestFiles.length > 1) {
    outputCompositeResults(compositeStats)
  }
  reset()
  function reset() {
    singletonReset()
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
    console.log({globFiles, testPath, root: config.root, patt: config.testPatterns, ignore: config.ignorePatterns})
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


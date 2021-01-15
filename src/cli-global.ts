#!/usr/bin/env node

import fs from 'fs-extra'
import {getConfig} from './config'
import path from 'path'
import { spawn } from 'child_process'
import { promisify } from 'util'
import ('source-map-support/register')

process.env.TEZT = "cli"
process.env.FORCE_COLOR = process.env.FORCE_COLOR || "1"
async function main() {
  const config = await getConfig()
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
    if (fs.existsSync(path.resolve(config.root, 'yarn.lock'))) {
      let yarnCwdArg = ''
      if (config.root !== process.cwd()) {
        yarnCwdArg = '--cwd ' + config.root
      }
      console.log(`yarn add ${yarnCwdArg} --dev tezt`)
    } else if (fs.existsSync(path.resolve(config.root, 'package-lock.json'))) {
      if (config.root !== process.cwd()) {
        console.log(`(cd ${config.root} && npm install --save-dev tezt)`)
      } else {
        console.log(`npm install --save-dev tezt`)
      }
    } else {
      console.error('You must install tezt locally as well in order to use the CLI.')
    }
    process.exit(1)
  }
  spawn('node', [
    path.resolve(config.root, 'node_modules', 'tezt', 'dist', 'cli.js'),
    ...process.argv.slice(2)],
    {
      stdio: 'inherit',
      cwd: process.cwd(),
    },
  )
}
main()
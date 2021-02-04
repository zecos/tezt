#!/usr/bin/env node

import fs from 'fs-extra'
import {getConfig} from './config'
import path from 'path'
import { spawn } from 'child_process'
import ('source-map-support/register')
import {renderString} from 'termd/src/termd'

process.env.NODE_ENV = "test"
process.env.TEZT = "cli"
process.env.FORCE_COLOR = process.env.FORCE_COLOR || "1"
async function main() {
  if (process.argv.includes("--version") || process.argv.includes("-v")) {
    const packageJson = await import("../package.json")
    console.log(packageJson.version)
    process.exit()
  }
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    const readMePath = path.resolve(__dirname, '..', '..', 'README.md')
    const str = (await fs.readFile(readMePath)).toString()
    const md = renderString(str)
    console.log(md)
    process.exit()
  }
  const config = await getConfig()
  spawn('node', [
    path.resolve(config.root, 'node_modules', 'tezt', 'dist', 'src', 'cli.js'),
    ...process.argv.slice(2)],
    {
      stdio: 'inherit',
      cwd: process.cwd(),
    },
  )
}
main()
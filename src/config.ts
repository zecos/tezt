import fs from 'fs-extra'
import path, { resolve } from 'path'

const baseDefault = {
  // glob for test files
  testPatterns: '{**/,}*.(test|spec).{js,ts}{,x}',
  // globs of files to ignore
  ignorePatterns: [
    '{**/,}node_modules/**',
    '{**/,}dist/**',
    '{**/,}build/**',
    '{**/,}*.d.ts'
  ],
  // globs for files to watch for changes when using --watch
  watchPatterns: ['{**/,}*.{ts,js}{,x}'],
  // test files and directories of files too look in for test files
  testPaths: [process.cwd()],
  // emulate the dom during tests
  dom: false,
  // whether or not to look for an exported "test" function
  fns: true,
}

export async function getConfig() {
  const root = await getProjectRoot()
  const commandLineConfig =  await parseCommandLineArgs()
  const userConfig = await getUserConfig(commandLineConfig.root || root)
  const fnsDefault = {
    ...baseDefault,
    fns: true,
    testPatterns: '{**/,}*.{js,ts}{,x}',
    root,
  }
  const defaultConfig = {
    ...baseDefault,
    testPatterns: '{**/,}*.{test,spec}.{js,ts}{,x}',
    fns: false,
    root,
  }
  const def = (commandLineConfig.fns || (userConfig || {}).fns) ? fnsDefault : defaultConfig

  const config =  {
    ...def,
    ...userConfig,
    ...commandLineConfig,
  }
  if (config.init) {
    await init(config)
    process.exit()
  }

  return config
}

const strArr = arr => `['${arr.join("', '")}']`

async function init(config) {
  if (!config.root) {
    console.error('You must run this from within a node project (with a package.json)')
    process.exit(1)
  }
  await fs.writeFile(resolve(config.root, 'tezt.config.js'),
`module.exports = {
  // glob for test files
  testPatterns: '${config.testPatterns}',
  // globs of files to ignore
  ignorePatterns: ${strArr(config.ignorePatterns)},
  // globs for files to watch for changes when using --watch
  watchPatterns: ${strArr(config.watchPatterns)},
  // test files and directories of files too look in for test files
  testPaths: [__dirname],
  // include virtual dom (js-dom)
  dom: ${config.dom},
  // whether or not to look for an exported "test" function
  fns: ${config.fns},
}`)
}

async function parseCommandLineArgs() {
  const config:any = {}
  const seen:any = {}
  const args = process.argv.slice(2)
  const testPaths: string[] = []
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (['-w', '--watch'].includes(arg)) {
      config.watch = true
    } else if (['--dom', '-d'].includes(arg)) {
      config.dom = true
    } else if (['--root', '-r'].includes(arg)) {
      const root = args[i+1]
      config.root = root
      if (!await fs.exists(root)) {
        throw new Error('Could not find root ' + root)
      }
    } else if (['--fns'].includes(arg)) {
      config.fns = true
    } else if (['--init'].includes(arg)) {
      config.init = true
    } else if (['--test-patterns', '-t'].includes(arg)) {
      while(!args[i+1].startsWith('-')) {
        config.testPatterns = args[++i]
      }
    } else if (['--ignore-patterns', '-i'].includes(arg)) {
      while(args[i+1] && !args[i+1].startsWith('-')) {
        if (!seen.ignorePatterns) {
          seen.ignorePatterns = true
          config.ignorePatterns = []
        }
        config.ignorePatterns.push(args[++i])
      }
    } else if (['--watch-patterns', '--wp'].includes(arg)) {
      while(args[i+1] && !args[i+1].startsWith('-')) {
        if (!seen.watchPatterns) {
          seen.watchPatterns = true
          config.watchPatterns = []
        }
        config.watchPatterns = [].concat(args[++i])
      }
    } else {
      testPaths.push(arg)
    }
  }
  if (testPaths.length) {
    config.testPaths = testPaths
  }
  return config
}

async function getUserConfig(root) {
  if (!root) {
    root = process.cwd()
  }
  const teztConfigPath = path.join(root, 'tezt.config.js')
  const hasTeztConfigPath = await fs.exists(teztConfigPath)
  if (hasTeztConfigPath) {
    return require(teztConfigPath)
  } else {
    const teztConfigPath = path.join(root, 'tezt.config.ts')
    const hasTeztConfigPath = await fs.exists(teztConfigPath)
    if (hasTeztConfigPath) {
      return await import(teztConfigPath)
    }
  }
  const packageJsonPath = path.join(root, 'package.json')
  const hasPackageJson = await fs.exists(packageJsonPath)
  if (hasPackageJson) {
    const packageJson = fs.readJson(packageJsonPath)
    return packageJson.tezt
  }
}

async function getProjectRoot() {
  let curPath = process.cwd()
  while (curPath.length > 1) {
    const packageJsonPath = path.join(curPath, 'package.json')
    const hasPackageJson = await fs.exists(packageJsonPath)
    if (hasPackageJson) return curPath
    curPath = path.resolve(curPath, '..')
  }
}
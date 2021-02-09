import fs from 'fs-extra'
import path, { resolve } from 'path'
import JSON5 from 'json5'

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
  // default timeout for tests
  timeout: 5000,
  // default time to wait after test is complete for asynchronous errors
  gracePeriod: 5,
  // run tests in parallel, but track by filename of actual test
  parallel: true,
  // run file in test process before any tests are run
  preload: null,
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
  await checkConfig(config)

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
  // default timeout for tests
  timeout: ${config.timeout},
  // default time to wait after test is complete for asynchronous errors
  gracePeriod: ${config.gracePeriod},
  // run file in test process before any tests are run
  preload: ${config.preload},
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
    } else if (['--preload'].includes(arg)) {
      config.preload = args[++i]
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
    const packageJson = await fs.readJson(packageJsonPath)
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


const getJson5 = async (file:string) => {
  return JSON5.parse((await fs.readFile(file)).toString())
}


const checkConfig = async (config) => {
  const tsNodeString =`"ts-node": {
    "compilerOptions": {
      "modules": "commonjs"
    }
  }`
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
  if (fs.existsSync(path.resolve(config.root, "tsconfig.json"))) {
    const tsConfigJson = await getJson5(path.resolve(config.root, "tsconfig.json"))
    if (tsConfigJson.module && tsConfigJson.module !== "commonjs") {
      if (!tsConfigJson['ts-node']
        || !tsConfigJson['compilerOptions']
        || !tsConfigJson['compilerOptions']['modules']
        || tsConfigJson['compilerOptions']['modules'] !== 'commonjs') {
          console.error(`Please set "module" to "commonjs" in your tsconfig.json or `)
          console.error(`add \n${tsNodeString}\nto your tsconfig.json`)
          process.exit(1)
        }
    }
  }
}


import fs from 'fs-extra'
import path from 'path'

export async function getConfig() {
  const root = await getProjectRoot()
  const userConfig = await getUserConfig(root)
  const defaultConfig = {
    testPatterns: ["**/*.test.js"],
    ignorePatterns: ["node_modules/**", "**/.*"],
    watchPatterns: ["**/*.{ts,js}"],
    root,
  }
  const commandLineConfig =  await parseCommandLineArgs()

  const config =  {
    ...defaultConfig,
    ...userConfig,
    ...commandLineConfig
  }

  return config
}

async function parseCommandLineArgs() {
  const config:any = {}
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const nextArg = args[i+1]
    if (['-w', '--watch'].includes(arg)) {
      config.watch = true
    }
    if (['--root', '-r'].includes(arg)) {
      const root = args[i+1]
      config.root = root
      if (!await fs.exists(root)) {
        throw new Error('Could not find root ' + root)
      }
    }
    if (['--testPatterns', '-t'].includes(arg)) {
      while(!nextArg && nextArg.startsWith('-')) {
        config.testPatterns = [].concat(args[++i])
      }
    }
    if (['--ignorePatterns', '-i'].includes(arg)) {
      while(!nextArg && nextArg.startsWith('-')) {
        config.ignorePatterns = [].concat(args[++i])
      }
    }
    if (['--watchPatterns', '--wp'].includes(arg)) {
      while(!nextArg && nextArg.startsWith('-')) {
        config.watchPatterns = [].concat(args[++i])
      }
    }
  }
  return config
}

async function getUserConfig(root) {
  if (!root) {
    console.warn('no project root found')
    root = process.cwd()
  }
  const teztConfigPath = path.join(root, 'tezt.config.js')
  const hasTeztConfigPath = await fs.exists(teztConfigPath)
  if (hasTeztConfigPath) {
    return require(teztConfigPath)
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
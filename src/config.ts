import fs from 'fs-extra'
import path from 'path'

export async function getConfig() {
  const root = await getProjectRoot()
  const commandLineConfig =  await parseCommandLineArgs()
  const userConfig = await getUserConfig(commandLineConfig.root || root)
  const defaultConfig = {
    testPatterns: '**/*.{test,spec}.{js,ts}',
    ignorePatterns: ['node_modules/**', 'dist/**', 'build/**'],
    watchPatterns: ['**/*.{ts,js}'],
    testPaths: [process.cwd()],
    root,
  }

  const config =  {
    ...defaultConfig,
    ...userConfig,
    ...commandLineConfig,
  }

  return config
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
    } else if (['--root', '-r'].includes(arg)) {
      const root = args[i+1]
      config.root = root
      if (!await fs.exists(root)) {
        throw new Error('Could not find root ' + root)
      }
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
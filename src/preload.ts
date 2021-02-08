import fs from 'fs-extra'
import path from 'path'
declare var global: any

const ignoreDeps = [
  "ts-node",
  "source-map-support",
]
export const preloadModules = async (paths) => {
  for (const p of paths) {
    if (!fs.existsSync(p)) {
      continue
    }
    const stats = await fs.lstat(p)
    if (!stats.isDirectory()) {
      continue
    }
    const pkgPath = path.resolve(p, 'package.json')
    if (!fs.existsSync(pkgPath)) {
      continue
    }
    const pkgJson = await import(pkgPath)
    if (!pkgJson.dependencies) {
      continue
    }
    for (const dep of Object.keys(pkgJson.dependencies)) {
      if (ignoreDeps.some(ignoreDep => dep.includes(ignoreDep))) {
        continue
      }
      await import(path.resolve(p, 'node_modules', dep))
    }
  }
}
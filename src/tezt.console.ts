import { ILocation } from './location'
import { platform } from 'os'
import path from 'path'

export enum ConsoleOutputType {
  Warn,
  Error,
  Log
}

export interface IConsoleOutput {
  type: ConsoleOutputType
  message: string[]
  location: ILocation
}

const { log } = console
declare var global: any;
const getInstance = () => {
  if (global.$$TEZT_PARALLEL) {
    const {filepath} = getLocation(/Tezt\.trapRun/)
    if (global.$$teztInstances) {
      return global.$$teztInstances[path.relative(process.cwd(), filepath)]
    }
    return
  }
  return global.$$teztSingleton
}

export const patchConsole = () => {
  const originals = Object.assign({}, console)
  global.$$teztRealConsole = originals
  for (const key in originals) {
    console[key] = (...args) => {
      const instance = getInstance()
      if (instance && (typeof instance[key] === "function")) {
        return instance[key](...args)
      }
      return originals[key](...args)
    }
  }
}

// function getInstance(matchLine, words): ILocation {
//   if (!global.$$TEZT_PARALLEL) {
//     return global.$$teztSingleton
//   }
//   require('source-map-support/register')
//   const {stack} = new Error()
//   const lines = stack
//     .split('\n')
//   lines.reverse()

//   const lineIndex = lines.findIndex(line => matchLine.test(line))

//   const regExp = platform() !== "win32" ?
//     /.*\s\(?([^:]+):(\d+):\d+\)?$/ :
//     /.*\s\(?\w:([^:]+):(\d+):\d+\)?$/
//   for (let i = lineIndex; i > 0; i--) {
//     const fileLine = lines[lineIndex - 1]
//     const result = regExp.exec(fileLine)
//     if (!result) continue
//     const [_, filepath] = result
//     const relativePath = path.relative(process.cwd(), filepath)
//     if (global.$$teztInstances[relativePath]) {
//       log(relativePath)
//       log(...words)
//       return global.$$teztInstances[relativePath]
//     }
//   }
// }
export function getLocation(matchLine): ILocation {
  require('source-map-support/register')
  const {stack} = new Error()
  const lines = stack
    .split('\n')
  lines.reverse()

  const lineIndex = lines.findIndex(line => matchLine.test(line))

  const fileLine = lines[lineIndex + 1]
  const regExp = platform() !== "win32" ?
    /.*\s\(?([^:]+):(\d+):\d+\)?$/ :
    /.*\s\(?\w:([^:]+):(\d+):\d+\)?$/
  const result = regExp.exec(fileLine)
  if (!result) {
    return  {
      filepath: 'unknown',
      lineno: 'unkown',
    }
  }

  const [_, filepath, lineno] = result
  return {
    filepath,
    lineno,
  }
}
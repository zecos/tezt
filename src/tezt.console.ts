import { getLocation, ILocation } from './location'
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

declare var global: any;
const IS_PARALLEL = global.$$TEZT_PARALLEL
const getInstance = () => {
  if (IS_PARALLEL) {
    const {filepath} = getLocation(/tezt\.console\.(t|j)s/)
    return global.$$teztInstances[path.relative(process.cwd(), filepath)]
  }
  return global.$$teztSingleton
}

const { log } = console
export const patchConsole = () => {
  const originals = Object.assign({}, console)
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
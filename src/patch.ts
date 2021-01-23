import { platform } from 'os'
const noop = (...args) => {}

const log = console.log
export interface ILocation {
  filepath: string
  lineno: string
}

export class Location implements ILocation {
  constructor(public filepath, public lineno) {}
}

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
export function monkeyPatchConsole(options) {
  let prevConsoleLog = console.log
  let prevConsoleWarn = console.warn
  let prevConsoleError = console.error
  let onConsoleWarn = noop
  let onConsoleLog = noop
  let onConsoleError = noop
  console.log = (...args) => {
    onConsoleLog(...args)
    if (options.outputConsole) {
      prevConsoleLog(...args)
    }
  }
  console.warn = (...args) => {
    onConsoleWarn(...args)
    if (options.outputConsole) {
      prevConsoleWarn(...args)
    }
  }
  console.error = (...args) => {
    onConsoleError(...args)
    if (options.outputConsole) {
      prevConsoleError(...args)
    }
  }
  const dispose = () => {
    console.log = prevConsoleLog
    console.warn = prevConsoleWarn
    console.error = prevConsoleError

  }
  dispose.setConsoleOutput = setConsoleOutput
  return dispose

  function setConsoleOutput(outputArr) {
    const prevOnConsoleWarn = onConsoleWarn
    onConsoleWarn = (...args) => {
      outputArr.push({
        message: args.map(String),
        location: getLocation(/(Object.console\.warn|at console\.warn)/),
        type: ConsoleOutputType.Warn
      })
    }
    const prevOnConsoleError = onConsoleError
    onConsoleError = (...args) => {
      outputArr.push({
        message: args.map(String),
        location: getLocation(/(Object.console|at console\.error)/),
        type: ConsoleOutputType.Error
      })
    }
    const prevOnConsoleLog = onConsoleLog
    onConsoleLog = (...args) => {
      outputArr.push({
        message: args.map(String),
        location: getLocation(/(Object.console\.log|at console\.log)/),
        type: ConsoleOutputType.Log
      })
    }
    return () => {
      onConsoleWarn = prevOnConsoleWarn
      onConsoleError = prevOnConsoleError
      onConsoleLog = prevOnConsoleLog
    }
  }
}

const error = console.error
export function getLocation(matchLine): ILocation {
  require('source-map-support/register')
  const {stack} = new Error()
  const lines = stack
    .split('\n')

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
let allPromises: any[] = []
const NormalPromise:any = global.Promise
function monkeyPatchPromise() {
  ;(global as any).Promise = class Promise extends NormalPromise {
    constructor(...props) {
      super(...props)
      allPromises.push(this)
    }
  }
  return () => {
    ;(global as any).Promise = NormalPromise
    allPromises = []
  }
}
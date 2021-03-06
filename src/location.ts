import { platform } from 'os'

export interface ILocation {
  filepath: string
  lineno: string
}

export class Location implements ILocation {
  constructor(public filepath, public lineno) {}
}

declare var global: any;
const { log } = console
export function getLocation(matchLine): ILocation {
  const {stack} = new Error()
  const lines = stack
    .split('\n')
  lines.reverse()

  let lineIndex = lines.findIndex(line => matchLine.test(line))

  const fileLine = lines[lineIndex - 1]
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
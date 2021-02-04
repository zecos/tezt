import { ChildProcess, spawn } from 'child_process'
import { Runner } from './typings'
import ipc from 'node-ipc'
import path from 'path'
import { promisify } from 'util'
import { END, READY, TERMINATE } from './msg'

const {error} = console
ipc.config.id = 'tezt-master'
ipc.config.retry = 1500
ipc.config.silent = true

const startIPCServer = () => new Promise<void>((res, rej) => {
  ipc.serve(res)
  ipc.server.start()
})

export async function genRunners(numRunners: number) {
  const runners: Promise<Runner>[] = []
  await startIPCServer()
  for (const _ of iter(numRunners)) {
    runners.push(createRunner())
  }

  let nextRunner = runners.shift()
  return () => {
    setTimeout(() => {
      nextRunner = runners.shift()
      runners.push(createRunner())
    }, 0)
    return nextRunner
  }
}

function createRunner() {
  return new Promise<Runner>((res, rej) => {
    // forking messes up the source maps
    const runner = spawn('node', [
      '-r', 'source-map-support/register',
      path.join(__dirname, 'runner')
    ], {
      stdio: 'inherit',
    })
    const quitOnError = (err) => {
      error('There was an error creating child process.')
      error(err)
      process.exit(1)
    }
    runner.on('error', quitOnError)
    const waitForReady = (data, socket) => {
      if (data.type === READY && data.pid == runner.pid) {
        ipc.server.off('tezt.message', waitForReady)
        runner.off('error', quitOnError)
        res({
          subprocess: runner,
          socket,
        })
      }
    }
    ipc.server.on('tezt.message', waitForReady)
  })
}

function* iter(end = Infinity, step = 1) {
    let iterationCount = 0
    for (let i = 0; i < end; i += step) {
        iterationCount++
        yield i
    }
    return iterationCount
}

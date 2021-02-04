import cluster, {Worker} from 'cluster'
import { END, READY, TERMINATE } from './msg'

export function* genWorkers(numWorkers: number) {
  const workers: Promise<Worker>[] = []
  for (const _ of range(0, numWorkers)) {
    workers.push(createWorker())
  }
  let nextWorker = workers.shift()
  while (true) {
    yield nextWorker
    nextWorker = workers.shift()
    workers.push(createWorker())
  }
}

function createWorker(): Promise<Worker> {
  return new Promise((res, rej) => {
    const worker = cluster.fork()
    const detectReady = (message) => {
      if (message.type !== READY) {
        console.error('Something went wrong creating the worker')
        console.error(message)
        process.exit(1)
      }
      worker.off('message', detectReady)
      res(worker)
    }
    worker.on('message', detectReady)
  })
}

function* range(start = 0, end = Infinity, step = 1) {
    let iterationCount = 0
    for (let i = start; i < end; i += step) {
        iterationCount++
        yield i
    }
    return iterationCount
}

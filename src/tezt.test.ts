import expect from 'expect'
import EventEmitter from 'events'
import { test, describe, before, after, afterEach, beforeEach, only } from './tezt.singleton'
import ('source-map-support/register')

before(() => {
  console.log('this is run before all')
})

let called = 0
describe.only('hellohello', () => {
  describe.skip('describes can also be onlys, and all tests contained ', () => {
    before(() => {
      console.warn('this is run before')
    })
    describe.only('myonly', () => {
      test('hello', ()=>{
        console.log(++called)
        throw new Error
      })
      // test('new test', () =>{})
      // test('will be run (unless there\'s another only in the describe', () => {})
    })
  })
})

test('this is my test', () => {
  expect('hello').toBe('hello')
})

test.skip(`this test won't be run`, () => {
  throw new Error('This is never thrown')
})

describe('I can describe a group of tests', () => {
  before(() => {
    console.log('this is run before all tests in this describe block')
  })

  after(() => {
    console.log('this is run after all tests in this describe block')
  })

  test.skip('this test won\'t run', () => {
    console.log('this is never output')
  })



  test.only('this is the only test that will be run aside from the describe only tests', () => {
    // throw new Error('This error will be thrown, but the rest of the tests will still run')
  })

  test(`this test won't be run, because it didn't specify only`, () => {
    console.log('this is not run')
  })

  describe.only('I can nest as many describes as I want', () => {
    test('and they can include as many', () => {
      console.log('tests as they want')
    })
    test('and they can include as many', () => {
      console.log('tests as they want')
    })

    describe.skip('not real', () => {
      test.only('hello', () => {})
    })
    test('and they can include as many', () => {
      console.log('tests as they want')
    })
  })
})

describe('You can also run beforeEach and afterEach test', () => {
  beforeEach(() => {
    console.log('this will output before each test')
  })
  afterEach(() => {
    console.log('this will output after each test')
  })
  for (let i = 0; i < 5; i++) {
    test(`test ${i}`, () => {})
  }

})

describe.only('hellohello', () => {
  describe.skip('describes can also be onlys, and all tests contained ', () => {
    before(() => {
      console.log('this is run before')
    })
    describe('myonly', () => {
      test('hello', ()=>{})
      // test('new test', () =>{})
      // test('will be run (unless there\'s another only in the describe', () => {})
    })
  })
})

test('I can also run asynchonous tests', async () => {
  await new Promise<void>((res, rej) => {
    expect('the test will not return until the promise has resolved').toBeTruthy()
    res()
  })
})
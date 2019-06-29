This is a minimalistic testing library that doesn't usurp control of your node process. This makes it easy to run with VS Code's debugger or with you can listen with Chrome's debugger as well.

The tests can also be run with Mocha or Jest without making any changes to your code, so you get the best of both worlds.

Implementation is as easy as importing your module, declaring your tests, and running that file.

Like so:

```ts
import expect from 'expect'
import { test, describe, before, after, afterEach, beforeEach } from './tezt'

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
    throw new Error('This error will be thrown, but the rest of the tests will still run')
  })

  test(`this test won't be run, because it didn't specify only`, () => {
    console.log('this is not run')
  })

  describe('I can nest as many describes as I want', () => {
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

describe.only('describes can also be onlys, and all tests contained ', () => {
  test('will be run (unless there\'s another only in the describe', () => {})
})

test('I can also run asynchonous tests', async () => {
  await new Promise((res, rej) => {
    expect('the test will not return until the promise has resolved').toBeTruthy()
    res()
  })
})
```

### Why?

My use case is pretty simple. I wanted to use VS Code's debugger with jest or mocha, but I couldn't figure out how to get that to work. I've also had bad luck with those libraries in the past, I feel, because they try to do too much, and bugs can be hard to trace. This is just a simple library with about 300 lines of code that anyone can use or understand.

You can also feel free to fork and make it your own. Because of its simplicity, there aren't many places where you're pigeon holed into the design of a colossal project and can't even figure out how it works.

I wrote this library as I needed it, and that was literally faster than trying to get mocha or jest to work.

### Use With VS Code

Speaking of launch configurations, this is the `launch.json` I use to run my tests with VS Code's debugger:


```json
{
  "name": "Run Current File",
  "type": "node",
  "request": "launch",
  "program": "${workspaceRoot}/${relativeFile}",
  "env": {
      "FORCE_COLOR": "1"
  },
  "skipFiles": [
      "<node_internals>/**/*.js",
  ],
  "outFiles": [
      "${workspaceRoot}/dist/**/*.js"
  ]
}
```

But you have to also have the files being generated automatically to run this, and this launch configuration assumes your `outDir` is set to a directory called `dist` in your current workspace.

This is the `tsconfig.json` I use:

```json
{
  "compilerOptions": {
    "target": "esnext",
    "outDir": "dist", // this is the important part
    "sourceMap": true,
    "noEmitOnError": false,
    "module": "commonjs",
    "moduleResolution": "node",
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "lib": [
      "dom",
      "dom.iterable",
      "esnext",
    ]
  },
  "files": [
    "index",
  ],
  "include": [
    "**/*.test.ts",
  ],
  "exclude": [
    "node_modules"
  ]
}
```

Again though, you have to make sure the typescript file is constantly being built with `tsc -w`. This is the task I use:

```json
{
  "label": "Compile Watch",
  "type": "shell",
  "command": "tsc -w",
  "options": {
    "cwd": "${workspaceRoot}"
  },
  "presentation": {
    "reveal": "always",
    "panel": "dedicated",
    "focus": false
  }
}
```

not saying everyone will necessarily want to use this, but maybe it will make it easier for some people.

### Related

[jest](https://jestjs.io)
[mocha](https://mochajs.org)
This is a minimalistic testing library that doesn't usurp control of your node process. This makes it easy to run with VS Code's debugger or with you can listen with Chrome's debugger as well.

The tests can also be run with Mocha or Jest without making any changes to your code, so you get the best of both worlds.

Implementation is as easy as importing your module, declaring your tests, and running that file.

Like so:

```ts
import expect from 'expect'
import { test, describe, before, after, afterEach, beforeEach } from 'tezt'

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


  test.only('this is the only test that will be run aside from the describe.only tests', () => {
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

### Use With VS Code

Speaking of launch configurations, this is the `launch.json` I use to run my tests with VS Code's debugger:


```json
{
  "version": "0.2.0",
  "configurations": [
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
  ]
}
```

This launch configuration assumes your `outDir` is set to a directory called `dist` in your current workspace.

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

You have to make sure the typescript file is constantly being built with `tsc -w`. This is the task I use:

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

Sample jest configuration (for typescript):

```json
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "testMatch": [
      "**/*.test.ts"
    ]
  }
}
```

Install dependencies for sample configuration:

`yarn add --dev @types/jest @types/node ts-jest typescript expect tezt`

not saying everyone will necessarily want to use this, but maybe it will make it easier for some people.

### Related

[jest](https://jestjs.io)
[mocha](https://mochajs.org)


### TODO

* add snapshotting
* should be able to run global tezt from a parent directory, and it run tezt on all sub directories that have tezt installed
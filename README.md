## Tezt

***BUYER BEWARE: This is a work in process...it's all right, but it's not really ready for production use, and there are probably a lot of bugs..and I'm not sure how long it will take me to fix reported issues/add features***

This is a minimalistic testing library that doesn't usurp control of your node process.

The advantages of this library are:

* Works out of the box with typescript or javascript files
* Easy to use with VS Code or Google Chrome's debugger
* Source map lines don't get messed up
* Compatible with jest and mocha (although not all features are implemented yet)
* You can run a test file as you would a normal file

#### Installation

In your project:

```
yarn add --dev tezt
```

or

```
npm i --save-dev
```

Additionally, for command line use (which you probably want):

```
yarn global add tezt
```

or

```
npm i -g tezt
```

You need `tezt` installed globally for it to work locally.


#### Writing test files

Implementation is as easy as importing your module, declaring your tests, and running that file.


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

#### Running tests

As stated above, you can simply run the file. If you're using typescript, you would run the test with

```
ts-node '<yourfilename>'
```

You can also use the command line tool, which you will have to install with yarn or npm

```
yarn global add tezt
npm i -g tezt
```

Then you can run that same file with

```
tezt <yourfilename>
```

You can also watch that test file, so node will not have to bootload its runtime every time you want to run a test suite.

```
tezt <yourfilename> -w
```

You can also run multiple files at the same time:

```
tezt <yourfilename> <yoursecondfilename>
```

If a directory is specified, `tezt` will crawl all children of the directory and run all the test files.

```
tezt <my-dir>
```

If you don't specify any files or directories, it will default to your cwd:

```
tezt
```

You can specify a [glob](https://www.malikbrowne.com/blog/a-beginners-guide-glob-patterns) for the patterns of test files you want to include (`-t` or `--test-patterns`).

```
tezt --test-patterns '**/*.(test|spec).{js,ts}'
```

You can also specify patterns to ignore (`--ignore-patterns` or `-i`):

```
tezt --ignore-patterns 'node_modules/**' '**/.*' 'dist/**' 'build/**'
```

You can also specify which files you want to trigger a re-test (if using the `--watch` flag) (`--watch-patterns` or `--wp`):

```
tezt --watch-patterns '**/*.{ts,js}'
```

You cna also specify a project root if you are not in a directory or subdirectory of your project (`--root` or `-r`):

```
tezt --root myproj
```

Finally, you can set these flags programmatically by adding a file named `tezt.config.js` in your root directory and exporting a configuration:


```js
// tezt.config.js
module.exports = {
  testPatterns: '**/*.{test,spec}.{js,ts}',
  ignorePatterns: ['node_modules/**', '**/.*', 'dist/**', 'build/**'],
  watchPatterns: ['**/*.{ts,js}'],
  testPaths: ['src'],
}
```

***Ignore the rest of this, I'm not sure if it works right now***

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
  * note: this will require removing duplicates...so if there's a duplicate
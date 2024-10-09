# just-build-tools
Dependency graph tools for building, testing, and deploying on your CI/CD of choice.

This tool is designed for polyglot monorepo builds, or cases where submodules have different version requirements of same package, or for devs who don't want a heavy handed build framework.

`just-build-tools` uses the cmd runner [just](https://github.com/casey/just).

## Getting Started

Add `just-depends-on.yml` and `justfile` to each subdirectory you want to build. Then run `npx just-build-tools build` build all dependent modules in order.

```sh
npx just-build-tools build
Building project ... root = ~/just-depends-on/example
Dependency order [ [ 'package_1', 'package_2' ], [ 'app_2', 'package_3' ], [ 'app_1' ] ]
-----------------------------------------
build package_1...
-----------------------------------------
-----------------------------------------
Finished build package_1
-----------------------------------------
-----------------------------------------
build package_2...
-----------------------------------------
...
-----------------------------------------
build app_1...
-----------------------------------------
-----------------------------------------
Finished build app_1
-----------------------------------------
```

## File convention
The following just commands as a standard (to be reviewed) `build, test, package, upload, deploy`.
```
/
/app_1/
...just-depends-on.yml
...justfile
/app_2/
...just-depends-on.yml
...justfile
/package_1/
...just-depends-on.yml
...justfile
/package_2/
...just-depends-on.yml
...justfile
/package_3/
...just-depends-on.yml
...justfile
```

Example `just-depends-on.yml` might look like this,
```yml
//frontend-app
build:
  - package_1
  - package_3
package:
  - package_1
  - package_3
test:
  - package_1
  - package_3
upload:
  - package_1
  - package_3
deploy:
  - api_1
  - api_2
  - api_3

```

Example `justfile` may look like this
```justfile
#!/usr/bin/env just --justfile

build:
    yarn
    yarn generate
    yarn build

test:
    yarn test

package:
    yarn export

deploy:
    terraform init
    terraform apply --auto-approve
```

## Creating ci config
(Currently circle ci only supported)

Creating a file in each subdirectory `circleci-build.yml` allows the `just-build-tools` to create a top level circle ci config file with required dependencies injected.

Example `circleci-build.yml`, everything under `build` is standard job circle ci config. everything under workflow is standard workflow job config.
```yml
build:
  - app1-build-step-1:
      working_directory: ~/app_1
      docker:
        - image: circleci/node:latest
      steps:
        - checkout
        - run:
            name: Build app1
            command: just build
  - app1-build-step-2:
      working_directory: ~/app_2
      docker:
        - image: circleci/node:latest
      steps:
        - checkout
        - run:
            name: Do something else
            command: echo do something


workflow:
  - app1-build-step-1:
      context:
        - context-1
        - slack-context
  - app1-build-step-2:
      requires:
        - app1-build-step-1
      context:
        - context-1
        - slack-context
```

This will be output to `out/circle-config.yml`, for example.
```yml
version: 2
jobs:
  - package-1-build:
      working_directory: ~/package_1
      docker:
        - image: circleci/node:latest
      steps:
        - checkout
        - run:
            name: Build package_1
            command: just build
  - package-3-build:
      working_directory: ~/package_3
      docker:
        - image: circleci/node:latest
      steps:
        - checkout
        - run:
            name: Build package_3
            command: just build
  - app1-build-step-1:
      working_directory: ~/app_1
      docker:
        - image: circleci/node:latest
      steps:
        - checkout
        - run:
            name: Build app1
            command: just build
  - app1-build-step-2:
      working_directory: ~/app_2
      docker:
        - image: circleci/node:latest
      steps:
        - checkout
        - run:
            name: Do something else
            command: echo do something

workflows:
  build:
    jobs:
      - package-1-build:
          context:
            - context-1
            - slack-context
          requires: []
      - package-3-build:
          context:
            - context-3
            - slack-context
      - app1-build-step-1:
          requires:
            - package-1-build
            - package-3-build
          context:
            - context-1
            - slack-context
      - app1-build-step-2:
          requires:
            - app1-build-step-1
            - package-1-build
            - package-3-build
          context:
            - context-1
            - slack-context

```


## Running the cli
Cli can be run via `npx`
```
npx just-build-tools build
```

All options viewable by
```sh
Usage: just-build-tools [options] [command]

A simple CLI tool in TypeScript

Options:
  -V, --version        output the version number
  -h, --help           display help for command

Commands:
  build [options]      Build whole project
  deploy [options]     Deploy whole project
  test [options]       Test whole project
  package [options]    Package whole project
  ci [options] <type>  Generate ci config for whole project
  help                 Display help information
```


## Contributing
Requirements
- Node
- Yarn

To get setup run,
```
yarn
yarn build
```

### Testing locally
To test cmd line.
```sh
yarn build && yarn start <cli args>
```

### Testing locally in another project

```sh
yarn start-registry
yarn build
yarn publish-local
npm_config_registry=http://localhost:4873 npx just-build-tools build -f example
```




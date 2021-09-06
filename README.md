# OpenAPI Generator+

A code generator platform for OpenAPI 2.0 and 3.0 written in TypeScript and Node.js, with modular language-specific generator modules.

## Installing and using

See [OpenAPI Generator+ CLI](https://github.com/karlvr/openapi-generator-plus/tree/master/packages/cli) for more information.

## Building the project

This project uses [nvm](https://github.com/nvm-sh/nvm) for managing the versions of node, and [pnpm](https://pnpm.io) for installing packages and managing the monorepo project structure.

To setup `nvm`:

```shell
nvm install
nvm use
```

To install pnpm:

```shell
npm -g install pnpm
```

To install and build the project:

```shell
pnpm install
pnpm build
pnpm watch
```

To run the tests:

```shell
pnpm test
```

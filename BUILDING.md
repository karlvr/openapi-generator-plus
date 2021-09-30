# Building OpenAPI Generator Plus

## Setup

This project uses [nvm](https://github.com/nvm-sh/nvm) for managing the versions of node, and [pnpm](https://pnpm.io) for installing packages and managing the monorepo project structure.

### `nvm`

Use the one-line installation on the [nvm website](https://github.com/nvm-sh/nvm).

### `pnpm`

Install [pnpm](https://pnpm.io) using `npm`:

```shell
npm -g install pnpm
```

## Building

Install and use the right `node` version:

```shell
nvm install
nvm use
```

Install the dependencies:

```shell
pnpm install
```

Build the project:

```shell
pnpm build
```

Run a build-watch while developing:

```shell
pnpm watch
```

Test the project:

```shell
pnpm test
```

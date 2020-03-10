# OpenAPI Generator+

A code generator platform for OpenAPI 2.0 and 3.0 written in TypeScript and Node.js, with modular language-specific generator modules.

## Installing and using

See [OpenAPI Generator+ CLI](https://github.com/karlvr/openapi-generator-plus/tree/master/packages/cli) for more information.

## Building the project

This project uses [nvm](https://github.com/nvm-sh/nvm) for managing the versions of node and npm, and [lerna](https://github.com/lerna/lerna) for managing the monorepo project structure.

To setup `nvm`:

```shell
nvm install
nvm use
```

To install and build the project:

```shell
npx lerna bootstrap
npm run build
npm run watch
```

To run the tests:

```shell
npm test
```

## Background

OpenAPI Generator+ is a reimplementation of code generation for OpenAPI specifications, following
in the footsteps of
[swagger-codegen](https://github.com/swagger-api/swagger-codegen) and
[openapi-generator](https://github.com/OpenAPITools/openapi-generator).

OG+ is written in TypeScript and uses Node.js. OG+ aims to provide a strong core to transform API specifications for code generation,
and to rely on separate code generation modules for the final code generation step. This separation enables the templates and
minimal code required for each new language to be developed, packaged and published independently, making customisation more powerful
and easily accessible.

## Templates

OG+ has an incompatible object model and approach to other Swagger / OpenAPI code generators so templates
must be rewritten or modified in order to be used with OGN. This is usually not a complicated process as the
properties available to templates are well-defined by TypeScript interfaces.

### Handlebars

OG+ uses [Handlebars](https://handlebarsjs.com) for templating. Handlebars builds on the functionality of the
[mustache](https://mustache.github.io) templates used in [swagger-codegen](https://github.com/swagger-api/swagger-codegen)
making templates more powerful and easy to customise. Handlebars also supports custom helpers to put more
capability into templates, such as case transformations.

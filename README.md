# OpenAPI Generator ++

A code generator for OpenAPI 2.0 and 3.0 written in TypeScript and Node.js, with modular language-specific generators.

## Using

```
npm start [-c <config json>] -o <output dir> -g <generator module or path> <path or url to api spec>
```

## Building

This project uses [nvm](https://github.com/nvm-sh/nvm) to specify the preferred version of Node:

```
nvm install
nvm use
```

To install and build the project:

```
npm install
npm run build
```

## Status

OGN is currently working for OpenAPI 2 (Swagger) specifications, for the two code generation templates that the author
uses. It is ready for others to take a look to see if this approach suits your needs and aspirations.

## Background

OpenAPI Generator Node (OGN) is a reimplementation of code generation for OpenAPI specifications, following
in the footsteps of
[swagger-codegen](https://github.com/swagger-api/swagger-codegen) and
[openapi-generator](https://github.com/OpenAPITools/openapi-generator).

OGN is written in TypeScript and uses Node.js. OGN aims to provide a strong core to transform API specifications for code generation,
and to rely on separate code generation modules for the final code generation step. This separation enables the templates and
minimal code required for each new language to be developed, packaged and published separately, making customisation more powerful
and easily accessible.

## Templates

OGN has an incompatible object model and approach to other Swagger / OpenAPI code generators so templates
must be rewritten or modified in order to be used with OGN. This is usually not a complicated process.

### Handlebars

OGN uses [Handlebars](https://handlebarsjs.com) for templating. Handlebars builds on the functionality of the
[mustache](https://mustache.github.io) templates used in [swagger-codegen](https://github.com/swagger-api/swagger-codegen)
making templates more powerful and easy to customise. Handlebars also supports custom helpers to put more
capability into templates, such as case transformations.

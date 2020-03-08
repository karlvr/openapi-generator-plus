# OpenAPI Generator +

A code generator for OpenAPI 2.0 and 3.0 written in TypeScript and Node.js, with modular language-specific generators.

## Using

Install locally:

```shell
npm install --save-dev openapi-generator-plus
npx openapi-generator-plus [-c <config file>] [-o <output dir>] [-g <generator module or path>] [<path or url to api spec>]
```

You need to install a generator module to use with `-g`.

Or, if you prefer, install globally:

```
npm install -g openapi-generator-plus
openapi-generator-plus [-c <config file>] [-o <output dir>] [-g <generator module or path>] [<path or url to api spec>]
```

### Generators

Then you must install a generator module in order to generate code in your target language and style.

For example, we'll install a generator for a [Java server using the CXF library with CDI](https://github.com/karlvr/openapi-generator-plus-generators/tree/master/packages/java-cxf-cdi-server):

```shell
npm install --save-dev @openapi-generator-plus/java-cxf-cdi-server-generator
```

### Running

Each generator module has different configuration, which you can determine from the generator's README.

First try running without any configuration:

```shell
npm openapi-generator-plus -o build -g @openapi-generator-plus/java-cxf-cdi-server-generator api.yml
```

### Command-line options

Options to the generation process can be specified on the command-line or in a configuration file.

|Option|Description|
|------|-----------|
|`-c <path>`|The path to a configuration file to load (see below)|
|`-o <path>`|The path to the output directory.|
|`-g <module or path>`|The module name or path to a generator module.|
|`<path>`|The path to the input API specification.|

Command-line options override their respective configuration options (see below).

### Configuration

The configuration file may be YAML or JSON. A basic configuration file contains:

|Property|Type|Description|Default|
|--------|----|-----------|-------|
|`inputPath`|`string`|The path to the input API specification, relative to the config file.|`undefined`|
|`outputPath`|`string`|The path to the output directory, relative to the config file.|`undefined`|
|`generator`|`string`|The name of the generator module, or the path relative to the config file for the generator module.|`undefined`|

See the README for the generator module you're using for additional configuration options supported by that generator.

## Building

This project uses [nvm](https://github.com/nvm-sh/nvm) to specify the preferred version of Node:

```
nvm install
nvm use
```

To install and build the project:

```
npx lerna bootstrap
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

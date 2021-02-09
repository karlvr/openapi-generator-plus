# OpenAPI Generator+

A code generator for OpenAPI 2.0 and 3.0 written in TypeScript and Node.js, with modular language-specific generator modules.

## Installing

### Locally

We recommend installing OG+ locally in your project so you can control the version of the tool
and any generator modules that you use.

```shell
npm install --save-dev openapi-generator-plus
```

Then run using:

```shell
npx openapi-generator-plus ...
```

### Globally

Or, if you prefer, you can install OG+ globally:

```
npm install -g openapi-generator-plus
```

Then run using:

```shell
openapi-generator-plus ...
```

## Using

You can either specify all options on the command-line:

```shell
npx openapi-generator-plus [-c <config file>] [-o <output dir>] [-g <generator module or path>] [<path or url to api spec>]
```

Or you can put all or some of the options in a config file:

```shell
npx openapi-generator-plus -c <config file>
```

## Generator modules

OpenAPI Generator+ requires a generator module in order to generate code in your target language and style.

You can find generator modules on the [Generators Wiki Page](https://github.com/karlvr/openapi-generator-plus/wiki/Generators)
or by searching for the [#openapi-generator-plus-generator](https://www.npmjs.com/search?q=keywords:openapi-generator-plus-generator) keyword on npm.

For example, to install a generator for a [Java server using the CXF library with CDI](https://github.com/karlvr/openapi-generator-plus-generators/tree/master/packages/java-cxf-cdi-server):

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

## Operation grouping

API operations are grouped by the generator module. The usual mode of operation is to work out the name
of the group by:

1. A vendor extension `x-group` on the operation or path.
2. The first tag on the operation.
3. The first path component.

## Building

See [OpenAPI Generator+](https://github.com/karlvr/openapi-generator-plus) for more information.

import { CodegenConfig } from '@openapi-generator-plus/types'

export interface CommandLineOptions {
	config?: string
	output?: string
	generator?: string
	version?: string
	watch?: string
	clean?: boolean
	'include-tag'?: string | string[]
	'exclude-tag'?: string | string[]
	'include-path'?: string | string[]
	'exclude-path'?: string | string[]
	_: string[]
}

export interface CommandLineConfig extends CodegenConfig {
	inputPath: string
	outputPath: string
	generator: string
	includeTags?: string[]
	excludeTags?: string[]
	includePaths?: string[]
	excludePaths?: string[]
}

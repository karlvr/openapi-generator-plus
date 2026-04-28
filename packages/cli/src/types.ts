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
	'activate-extension'?: string | string[]
	'remove-extension'?: string | string[]
	_: string[]
}

export interface CommandLineConfig extends CodegenConfig {
	inputPath: string | string[]
	outputPath: string
	generator: string
	includeTags?: string[]
	excludeTags?: string[]
	includePaths?: string[]
	excludePaths?: string[]
	activateExtensions?: string[]
}

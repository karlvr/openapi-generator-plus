import { CodegenConfig } from '@openapi-generator-plus/types'

export interface CommandLineOptions {
	config?: string
	output?: string
	generator?: string
	version?: string
	watch?: string
	clean?: boolean
	_: string[]
}

export interface CommandLineConfig extends CodegenConfig {
	inputPath: string
	outputPath: string
	generator: string
}

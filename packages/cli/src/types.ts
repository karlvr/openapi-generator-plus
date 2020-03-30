export interface CommandLineOptions {
	config?: string
	output?: string
	generator?: string
	version?: string
	watch?: string
	clean?: boolean
	_: string[]
}

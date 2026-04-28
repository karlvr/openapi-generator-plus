import { OpenAPIFilters } from '@openapi-generator-plus/core'
import { CommandLineOptions } from './types'

/** getopts `string` option names for the spec filtering flags, used by both `generate` and `bundle`. */
export const FILTER_STRING_OPTIONS = ['include-tag', 'exclude-tag', 'include-path', 'exclude-path']

/**
 * Parses repeatable filter flags (--include-tag, --exclude-tag, --include-path, --exclude-path)
 * from a parsed getopts options object into an OpenAPIFilters object suitable for filterOpenAPISpec.
 * CLI flags fully replace any matching values when present (rather than appending), matching the
 * existing precedence used for --output and --generator.
 */
export function filtersFromCommandLine(commandLineOptions: CommandLineOptions | undefined, baseFilters?: OpenAPIFilters): OpenAPIFilters {
	const filters: OpenAPIFilters = { ...baseFilters }
	if (!commandLineOptions) {
		return filters
	}

	const includeTags = fromCommandLineConfigValue(commandLineOptions['include-tag'])
	const excludeTags = fromCommandLineConfigValue(commandLineOptions['exclude-tag'])
	const includePaths = fromCommandLineConfigValue(commandLineOptions['include-path'])
	const excludePaths = fromCommandLineConfigValue(commandLineOptions['exclude-path'])

	if (includeTags) {
		filters.includeTags = includeTags
	}
	if (excludeTags) {
		filters.excludeTags = excludeTags
	}
	if (includePaths) {
		filters.includePaths = includePaths
	}
	if (excludePaths) {
		filters.excludePaths = excludePaths
	}

	return filters
}

export function hasAnyFilter(filters: OpenAPIFilters): boolean {
	return !!(filters.includeTags?.length || filters.excludeTags?.length || filters.includePaths?.length || filters.excludePaths?.length)
}

/**
 * The command-line config is a string or an array, depending upon how many times the command-line option was
 * specified. Also it includes an empty string for each option if they were not provided on the command-line,
 * so we must filter those out here.
 * 
 * We also handle comma-separated values within one command-line option.
 */
export function fromCommandLineConfigValue(value: string | string[] | undefined): string[] | undefined {
	if (!value) {
		return undefined
	}
	if (!Array.isArray(value)) {
		value = [value]
	}
	return value
		.flatMap(s => s.split(','))
		.map(s => s.trim())
}

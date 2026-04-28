import { CommandLineOptions } from './types'
import { fromCommandLineConfigValue } from './filter'

/** getopts `string` option names for the --remove-extension flag. */
export const REMOVE_EXTENSION_STRING_OPTIONS = ['remove-extension']

/**
 * Parses the repeatable --remove-extension flag into a string array of glob-style patterns. Each
 * pattern targets vendor extension keys by their suffix (the part after `x-`), with `*` matching
 * any character sequence. Returns the parsed CLI value if any was supplied, otherwise falls back
 * to `base` (typically a config-file value). CLI flags fully replace any matching values when
 * present, matching the precedence used for filter flags.
 */
export function removeExtensionsFromCommandLine(commandLineOptions: CommandLineOptions | undefined, base?: string[]): string[] | undefined {
	const fromCli = fromCommandLineConfigValue(commandLineOptions?.['remove-extension'])
	if (fromCli) {
		return fromCli
	}
	return base
}

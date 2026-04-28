import { CommandLineOptions } from './types'
import { fromCommandLineConfigValue } from './filter'

/** getopts `string` option names for the --activate-extension flag. */
export const ACTIVATE_EXTENSION_STRING_OPTIONS = ['activate-extension']

/**
 * Parses the repeatable --activate-extension flag into a string array. Returns the parsed CLI value
 * if any was supplied, otherwise falls back to `base` (typically a config-file value). CLI flags
 * fully replace any matching values when present, matching the precedence used for filter flags.
 */
export function activateExtensionsFromCommandLine(commandLineOptions: CommandLineOptions | undefined, base?: string[]): string[] | undefined {
	const fromCli = fromCommandLineConfigValue(commandLineOptions?.['activate-extension'])
	if (fromCli) {
		return fromCli
	}
	return base
}

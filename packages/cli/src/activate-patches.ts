import { CommandLineOptions } from './types'
import { fromCommandLineConfigValue } from './filter'

/** getopts `string` option names for the --activate-patch flag. */
export const ACTIVATE_PATCH_STRING_OPTIONS = ['activate-patch']

/**
 * Parses the repeatable --activate-patch flag into a string array. Returns the parsed CLI value
 * if any was supplied, otherwise falls back to `base` (typically a config-file value). CLI flags
 * fully replace any matching values when present, matching the precedence used for filter flags.
 */
export function activatePatchesFromCommandLine(commandLineOptions: CommandLineOptions | undefined, base?: string[]): string[] | undefined {
	const fromCli = fromCommandLineConfigValue(commandLineOptions?.['activate-patch'])
	if (fromCli) {
		return fromCli
	}
	return base
}

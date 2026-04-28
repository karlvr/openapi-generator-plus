import { CommandLineOptions } from './types'
import { fromCommandLineConfigValue } from './filter'

/** getopts `string` option names for the --remove-extension flag. */
export const REMOVE_EXTENSION_STRING_OPTIONS = ['remove-extension']

/**
 * Parses the repeatable --remove-extension flag into a string array of glob-style patterns. Each
 * pattern targets vendor extension keys by their suffix (the part after `x-`), with `*` matching
 * any character sequence. Returns the parsed CLI value if any was supplied, otherwise `undefined`.
 */
export function removeExtensionsFromCommandLine(commandLineOptions: CommandLineOptions | undefined): string[] | undefined {
	return fromCommandLineConfigValue(commandLineOptions?.['remove-extension'])
}

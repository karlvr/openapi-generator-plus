export function usage(): void {
	console.log(`usage: ${process.argv[1]} [generate] [-c <config file>] [-o <output dir>] [-g <generator template or path>] [--watch] [--clean] [--include-tag <tag>] [--exclude-tag <tag>] [--include-path <glob>] [--exclude-path <glob>] [--activate-extension <name>] [<path or url to api spec> [<additional api spec> ...]]`)
	console.log(`       ${process.argv[1]} bundle [-o <output file>] [--include-tag <tag>] [--exclude-tag <tag>] [--include-path <glob>] [--exclude-path <glob>] [--activate-extension <name>] <path or url to api spec> [<additional api spec> ...]`)
}

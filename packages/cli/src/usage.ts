export function usage(): void {
	console.log(`usage: ${process.argv[1]} [generate] [-c <config file>] [-o <output dir>] [-g <generator template or path>] [--watch] [<path or url to api spec>]`)
}

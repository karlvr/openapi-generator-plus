import { promises as fs, existsSync as exists } from 'fs'
import process from 'process'
import c from 'ansi-colors'
import getopts from 'getopts'
import path from 'path'
import inquirer from 'inquirer'
import search from 'libnpmsearch'
import { exec, spawn, SpawnOptionsWithoutStdio } from 'child_process'
import util from 'util'

const myPackage = require('../package.json')
const execPromise = util.promisify(exec)

function die(message: string): never {
	console.warn(c.bold.red('[ERROR]'), message)
	process.exit(1)
}

function info(message: string): void {
	console.info(c.bold.green('[INFO]'), message)
}

function warn(message: string): void {
	console.info(c.bold.yellow('[WARN]'), message)
}

function help() {
	console.log(`usage: ${path.basename(process.argv[1])} [-g <generator module or keywords>] [<dest dir>]`)
}

function instructions() {
	console.log(`

${c.bold.green('Congratulations, your new OpenAPI generator project has been created!')}

Enter the path or URL for your API specification, and the path to output the
generated API, in the config.yml file.

Check out the README.md file for more information.
`)
}

function usage(): never {
	help()
	process.exit(1)
}

interface CommandLineOptions {
	generator?: string
	packageManager?: string
	version?: string
	help?: boolean
	_: string[]
}

interface Result extends search.Result {
	scope?: string
	links?: {
		homepage?: string
	}
}

async function run(): Promise<void> {
	const opts: CommandLineOptions = getopts(process.argv.slice(2), {
		alias: {
			generator: 'g',
			packageManager: 'p',
			version: 'v',
			help: 'h',
		},
		boolean: ['watch', 'clean'],
		unknown: (option) => {
			console.log(`Unknown option: ${option}`)
			return false
		},
	})

	if (opts.version) {
		console.log(myPackage.version)
		process.exit(0)
	} else if (opts.help) {
		help()
		process.exit(0)
	}

	let dest = '.'

	if (opts._.length === 1) {
		dest = opts._[0]
	} else if (opts._.length > 1) {
		usage()
	}

	info('Searching for the latest version of OpenAPI Generator Plus...')
	const cliPackage = await findCliVersion()
	if (!cliPackage) {
		die('Failed to query npmjs.com for the latest OpenAPI Generator Plus CLI version')
	}
	info(`Found: OpenAPI Generator Plus v${cliPackage.version}`)

	const { generators, filterType } = await filterByType(await findCandidates(opts.generator))
	const generator = await chooseGenerator(generators, filterType)

	const pkg = {
		name: 'openapi-generator-plus-project',
		version: '1.0.0',
		private: true,
		scripts: {
			build: 'openapi-generator-plus -c config.yml',
		},
		devDependencies: {
			'openapi-generator-plus': `^${cliPackage.version}`,
			[generator.name]: `^${generator.version}`,
		},
	}

	const packageJsonPath = path.join(dest, 'package.json')

	if (await exists(packageJsonPath)) {
		die(`package.json already exists at ${packageJsonPath}`)
		// TODO ask if you'd like to add to it
	}
	
	await fs.mkdir(dest, { recursive: true })
	await fs.writeFile(packageJsonPath, JSON.stringify(pkg, undefined, 4) + '\n')
	info(`Created ${packageJsonPath}`)

	const configPath = path.join(dest, 'config.yml')
	if (await exists(configPath)) {
		warn(`API generator config already exists at ${configPath}`)
	} else {
		let configText = `# OpenAPI Generator Plus generator configuration
#
# The path (relative to this configuration file) or a URL for your API specification
inputPath: api.yml

# The path (relative to this configuration file) where the generated API should be output
outputPath: dist

# The name of the generator template used
generator: "${generator.name}"
`
		if (generator.links?.homepage) {
			configText += `\n# See ${generator.links.homepage} for more configuration options\n`
		}
		await fs.writeFile(configPath, configText)
		info(`Created API generator config: ${configPath}`)
	}

	const packageManager = await choosePackageManager(opts.packageManager)

	const readmePath = path.join(dest, 'README.md')
	if (await exists(readmePath)) {
		warn(`README already exists at ${readmePath}`)
	} else {
		const projectReadme = await createReadme(packageManager, generator)
		await fs.writeFile(readmePath, projectReadme)
	}

	info(`Installing dependencies using ${packageManager}`)
	await spawnPromise(packageManager, ['install'], {
		cwd: dest,
	})

	instructions()
}

async function createReadme(packageManager: PackageManager, generator: Result) {
	const type = generatorType(generator)
	const generatorLink = formatLink(`\`${generator.name}\``, generator.links?.homepage)

	return `# OpenAPI Generator Plus generator project

${type === 'server' ? 'This project generates server code for providing an API.'
		: type === 'client' ? 'This project generates client code for accessing an API.'
			: type === 'documentation' ? 'This project generates API documentation.'
				: ''}

The generator template used is ${generatorLink}.

## Using

\`\`\`shell
${packageManager} install
${buildCommand(packageManager)}
\`\`\`

## Configuration

The API generator is configured in \`config.yml\`. See ${generatorLink} for configuration options.
`
}

function generatorType(generator: Result) {
	if (!generator.keywords) {
		return undefined
	}
	if (generator.keywords.indexOf('server') !== -1) {
		return 'server'
	} else if (generator.keywords.indexOf('client') !== -1) {
		return 'client'
	} else if (generator.keywords.indexOf('documentation') !== -1) {
		return 'documentation'
	} else {
		undefined
	}
}

function formatLink(text: string, link?: string) {
	if (link) {
		return `[${text}](${link})`
	} else {
		return text
	}
}

function buildCommand(packageManager: PackageManager) {
	switch (packageManager) {
		case 'npm': return 'npm run build'
		case 'yarn': return 'yarn build'
		case 'pnpm': return 'pnpm build'
	}
	throw new Error(`Unexpected package manager: ${packageManager}`)
}

async function spawnPromise(command: string, args: string[], options: SpawnOptionsWithoutStdio): Promise<number | null> {
	return new Promise(function(resolve) {
		const emitter = spawn(command, args, options)
		emitter.on('exit', function(code) {
			resolve(code)
		})
		emitter.stdout.pipe(process.stdout)
		emitter.stderr.pipe(process.stderr)
	})
}

type PackageManager = 'pnpm' | 'yarn' | 'npm'

async function choosePackageManager(preference?: string): Promise<PackageManager> {
	if (preference === 'pnpm' || preference === 'yarn' || preference === 'npm') {
		return preference
	} else if (preference) {
		die(`Unsupported package manager: ${preference}`)
	}

	if (await checkForPnpm()) {
		return 'pnpm'
	} else if (await checkForYarn()) {
		return 'yarn'
	} else {
		return 'npm'
	}
}

async function checkForPnpm() {
	try {
		await execPromise('pnpm -v')
		return true
	} catch (error) {
		return false
	}
}

async function checkForYarn() {
	try {
		await execPromise('yarn -v')
		return true
	} catch (error) {
		return false
	}
}

async function findCliVersion() {
	const results = await search('openapi-generator-plus', { limit: 1 })
	if (results.length === 0) {
		return undefined
	}
	if (results[0].name === 'openapi-generator-plus') {
		return results[0]
	}
	return undefined
}

async function findCandidates(name?: string) {
	if (!name) {
		info('Searching for generator modules...')
		const found = await search('openapi-generator-plus-generator')
		const generators = found.filter(keywordFilter('openapi-generator-plus-generator'))

		info(`Found ${generators.length} generator modules`)
		return generators
	} else {
		info(`Searching for generator modules: ${name}`)
		const found = await search(`openapi-generator-plus-generator ${name}`)
		const generators = found.filter(keywordFilter('openapi-generator-plus-generator'))
		if (generators.length === 0) {
			die(`Could not find any generator modules on npmjs.com matching "${name}"`)
		}
		info(`Found ${found.length} matching generator modules`)
		return generators
	}
}

async function filterByType(generators: Result[]): Promise<{ filterType?: string; generators: Result[] }> {
	const availableTypes = findAvailableTypes(generators)
	if (availableTypes.length === 0) {
		return { generators }
	}
	if (availableTypes.length <= 1) {
		return { filterType: availableTypes[0].value, generators }
	}

	const filterType = (await inquirer.prompt([
		{
			type: 'list',
			name: 'type',
			message: 'What type of generator module are you looking for?',
			choices: availableTypes,
		},
	])).type
	return { filterType, generators: generators.filter(keywordFilter(filterType)) }
}

async function chooseGenerator(generators: Result[], filterType?: string): Promise<Result> {
	if (generators.length === 1) {
		return generators[0]
	}

	const officialModules = generators.map(m => m as Result).filter(officialFilter)
	const thirdPartyModules = generators.map(m => m as Result).filter(thirdPartyFilter)

	const module: Result = (await inquirer.prompt([
		{
			type: 'list',
			pageSize: 20,
			name: 'generator',
			message: `Choose a ${filterType ? `${filterType} ` : ''}generator module to use to generate your API SDK`,
			choices: [
				new inquirer.Separator(`Official Generator Modules (${officialModules.length})`),
				...officialModules.map(m => ({
					name: displayResult(m),
					value: m,
					short: m.description,
				})),
				new inquirer.Separator(`Third Party Generator Modules (${thirdPartyModules.length})`),
				...thirdPartyModules.map(m => ({
					name: displayResult(m),
					value: m,
					short: m.description,
				})),
			],
		},
	])).generator
	return module
}

const GENERATOR_TYPES = [
	{
		name: 'Client',
		value: 'client',
	},
	{
		name: 'Server',
		value: 'server',
	},
	{
		name: 'Documentation',
		value: 'documentation',
	},
]

function findAvailableTypes(generators: Result[]) {
	const result = []
	for (const type of GENERATOR_TYPES) {
		if (generators.find(keywordFilter(type.value))) {
			result.push(type)
		}
	}
	return result
}

function displayResult(r: Result) {
	const name = r.name.replace(/^@openapi-generator-plus\//, '')
	if (r.description) {
		const description = r.description.replace(/^An OpenAPI Generator.* module for an? /, '')
		return `${pad(name, 50)}    ${description}`
	} else {
		return name
	}
}

function pad(s: string, n: number): string {
	return s + ' '.repeat(Math.max(0, n - s.length))
}

type ResultFilter = (r: Result) => boolean

function keywordFilter(keyword: string): ResultFilter {
	return function(r: Result) {
		return r.keywords ? r.keywords.indexOf(keyword) !== -1 : false
	}
}

function officialFilter(r: Result) {
	return r.scope === 'openapi-generator-plus'
}

function thirdPartyFilter(r: Result) {
	return r.scope !== 'openapi-generator-plus'
}

run()

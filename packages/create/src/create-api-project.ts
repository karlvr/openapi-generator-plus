import { PathLike, promises as fs } from 'fs'
import process from 'process'
import c from 'ansi-colors'
import getopts from 'getopts'
import path, { basename } from 'path'
import inquirer from 'inquirer'
import search from 'libnpmsearch'
import { exec, spawn, SpawnOptionsWithoutStdio } from 'child_process'
import util from 'util'

// eslint-disable-next-line @typescript-eslint/no-require-imports
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
	console.log(`usage: ${path.basename(process.argv[1])} [-g <generator template or keywords>] [-p <package manager>] [<dest dir>]`)
}

function instructions(readmePath: string) {
	console.log(`

${c.bold.green('Congratulations, your new OpenAPI generator project has been created!')}

Enter the path or URL for your API specification, and the path to output the
generated API, in the config.yml file.

Check out the ${basename(readmePath)} file for more information.
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

	await checkDestination(dest)

	const packageManager = await choosePackageManager(opts.packageManager)
	info(`Selected package manager: ${packageManager}`)

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
			generate: 'openapi-generator-plus -c config.yml',
		},
		devDependencies: {
			'openapi-generator-plus': `^${cliPackage.version}`,
			[generator.name]: `^${generator.version}`,
		},
	}

	await fs.mkdir(dest, { recursive: true })

	const packageJsonPath = path.join(dest, 'package.json')
	if (await exists(packageJsonPath)) {
		warn(`package.json already exists at ${packageJsonPath}; adding dependencies`)
		
		await addDependencies([
			`openapi-generator-plus@^${cliPackage.version}`,
			`${generator.name}@^${generator.version}`,
		], packageManager, dest)

		warn('Add the following script to your package.json manually: "scripts": { "generate": "openapi-generator-plus -c config.yml" }')
	} else {
		await fs.writeFile(packageJsonPath, JSON.stringify(pkg, undefined, 4) + '\n')
		info(`Created ${packageJsonPath}`)
	}

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

	let readmePath = path.join(dest, 'README.md')
	if (await exists(readmePath)) {
		readmePath = path.join(dest, 'README-openapi-generator-plus.md')
	}
	if (await exists(readmePath)) {
		warn(`README already exists at ${readmePath}`)
	} else {
		const projectReadme = await createReadme(packageManager, generator)
		await fs.writeFile(readmePath, projectReadme)
	}

	const gitignorePath = path.join(dest, '.gitignore')
	if (!await exists(gitignorePath)) {
		await fs.writeFile(gitignorePath, '/node_modules\n')
	}

	info(`Installing dependencies using ${packageManager}`)
	installDependencies(packageManager, dest)

	instructions(readmePath)
}

async function installDependencies(packageManager: PackageManager, dest: string) {
	await spawnPromise(packageManager, ['install'], {
		cwd: dest,
	})
}

async function addDependencies(dependencies: string[], packageManager: PackageManager, dest: string) {
	await spawnPromise(packageManager, [packageManager === 'npm' ? 'install' : 'add', ...dependencies], {
		cwd: dest,
	})
}

async function checkDestination(dest: string): Promise<void> {
	try {
		const stat = await fs.stat(dest)
		if (!stat.isDirectory()) {
			die(`${dest} already exists and is not a directory`)
		}

		const absoluteDest = path.resolve(dest)

		const files = await fs.readdir(dest)
		if (files.length > 0) {
			warn(`${absoluteDest} already exists and is not empty`)
			const confirm = (await inquirer.prompt([
				{
					type: 'confirm',
					message: 'Are you sure you want to create the project in this directory?',
					name: 'confirm',
				},
			])).confirm
			if (!confirm) {
				process.exit(1)
			}
		}
	} catch {
		/* It's fine if it doesn't exist */
		return
	}
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

The generate task requires a script configured in \`package.json\`. The default version of that script is:

\`\`\`json
"scripts": {
	"generate": "openapi-generator-plus -c config.yml"
}
\`\`\`

You may also wish to add \`--clean\` to that command in order to delete defunct files from the generated output.

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
		return undefined
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
		case 'npm': return 'npm run generate'
		case 'yarn': return 'yarn generate'
		case 'pnpm': return 'pnpm generate'
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
	} catch {
		return false
	}
}

async function checkForYarn() {
	try {
		await execPromise('yarn -v')
		return true
	} catch {
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
		info('Searching for generator templates...')
		const found = await search('keywords:openapi-generator-plus-generator')
		const generators = found.filter(keywordFilter('openapi-generator-plus-generator'))

		info(`Found ${generators.length} generator templates`)
		return generators
	} else {
		info(`Searching for generator templates: ${name}`)
		const found = await search(`openapi-generator-plus-generator ${name}`)
		const generators = found.filter(keywordFilter('openapi-generator-plus-generator'))
		if (generators.length === 0) {
			die(`Could not find any generator templates on npmjs.com matching "${name}"`)
		}
		info(`Found ${found.length} matching generator templates`)
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
			message: 'What type of generator template are you looking for?',
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
			message: `Choose a ${filterType ? `${filterType} ` : ''}generator template to use to generate your API SDK`,
			choices: [
				new inquirer.Separator(`Official Generator Templates (${officialModules.length})`),
				...officialModules.map(m => ({
					name: displayResult(m),
					value: m,
					short: m.name,
				})),
				new inquirer.Separator(`Third Party Generator Templates (${thirdPartyModules.length})`),
				...thirdPartyModules.map(m => ({
					name: displayResult(m),
					value: m,
					short: m.name,
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
	const name = r.name
		.replace(/^@openapi-generator-plus\//, '')
		.replace(/-generator$/, '')
	if (r.description) {
		const description = r.description.replace(/^An OpenAPI Generator.* (module|template) for an? /, '')
		return `${pad(name, 40)}    ${description}`
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

async function exists(path: PathLike): Promise<boolean> {
	try {
		await fs.stat(path)
		return true
	} catch {
		return false
	}
}

run()

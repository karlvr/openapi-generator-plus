import generateCommand from './generate'
import bundleCommand from './bundle'

export async function run(): Promise<void> {
	const command = process.argv.length > 2 && !process.argv[2].startsWith('-') ? process.argv[2] : ''
	switch (command) {
		case 'generate':
			return generateCommand(process.argv.slice(3))
		case 'bundle':
			return bundleCommand(process.argv.slice(3))
		default:
			/* We run generate by default */
			return generateCommand(process.argv.slice(2))
	}
}

run()

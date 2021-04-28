import { CodegenLogLevel } from '@openapi-generator-plus/types'
import c from 'ansi-colors'

export function log(level: CodegenLogLevel, message: string): void {
	switch (level) {
		case CodegenLogLevel.INFO:
			console.log(c.bold.blue('[INFO]'), message)
			return
		case CodegenLogLevel.WARN:
			console.warn(c.bold.yellow('[WARN]'), message)
			return
	}

	console.log(`[${level}]`, message)
}

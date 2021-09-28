import { CodegenLogLevel } from '@openapi-generator-plus/types'

export function defaultLog(level: CodegenLogLevel, message: string): void {
	switch (level) {
		case CodegenLogLevel.INFO:
			console.log(`[INFO] ${message}`)
			return
		case CodegenLogLevel.WARN:
			console.log(`[WARN] ${message}`)
			return
	}

	console.log(`[${level}] ${message}`)
}

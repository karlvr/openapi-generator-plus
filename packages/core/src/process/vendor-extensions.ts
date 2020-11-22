import { CodegenVendorExtensions } from '../../../types/dist'

interface ObjectWithVendorExtensions {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[index: string]: any
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function toCodegenVendorExtensions(ob: ObjectWithVendorExtensions): CodegenVendorExtensions | null {
	const result: CodegenVendorExtensions = {}
	let found = false

	for (const name in ob) {
		if (name.startsWith('x-')) {
			result[name] = ob[name]
			found = true
		}
	}

	return found ? result : null
}

/** Returns the string with the first character converted to upper-case */
export function capitalize(value: string) {
	if (value.length > 0) {
		return value.substring(0, 1).toUpperCase() + value.substring(1)
	} else {
		return value
	}
}

export function camelCase(value: string) {
	return value.replace(/([^a-zA-Z0-9]+)([a-zA-Z0-9])/g, (whole, sep, letter) => capitalize(letter))
}

export function pascalCase(value: string) {
	return capitalize(camelCase(value))
}

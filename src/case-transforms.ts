/** Returns the string with the first character converted to upper-case */
export function capitalize(value: string) {
	if (value.length > 0) {
		return value.substring(0, 1).toUpperCase() + value.substring(1)
	} else {
		return value
	}
}

export function camelCase(value: string) {
	value = value.replace(/([^a-zA-Z0-9]+)([a-zA-Z0-9])/g, (whole, sep, letter) => capitalize(letter))
	/* If the string starts with capitals, we need to lower-case that first word */
	value = value.replace(/^([A-Z]+)([A-Z])/, (whole, first, next) => first.toLocaleLowerCase() + next)
	/* If the string starts with a capital letter, lower-case it */
	value = value.replace(/^[A-Z]/, (whole) => whole.toLocaleLowerCase())
	return value
}

export function pascalCase(value: string) {
	value = value.replace(/([^a-zA-Z0-9]+)([a-zA-Z0-9])/g, (whole, sep, letter) => capitalize(letter))
	return capitalize(value)
}

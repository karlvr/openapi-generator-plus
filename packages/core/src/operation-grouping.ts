import { CodegenOperation, CodegenOperationGroups, CodegenOperationGroup, CodegenState } from '@openapi-generator-plus/types'

function prepareOperationForGroup(operation: CodegenOperation, group: CodegenOperationGroup) {
	if (group.path !== '') {
		if (operation.path === group.path) {
			operation.path = ''
		} else if (operation.path.startsWith(`${group.path}/`)) {
			operation.path = operation.path.substring(group.path.length)
		} else {
			/* The operation path isn't compatible, so convert the group to not specify a common path */
			for (const otherOperation of group.operations) {
				otherOperation.path = `${group.path}${otherOperation.path}`
			}
			group.path = ''
		}
	}
}

function addToGroups(operation: CodegenOperation, groupName: string, groupPath: string, groups: CodegenOperationGroups, state: CodegenState): void {
	groupName = state.generator.toOperationGroupName(groupName)

	let group = groups[groupName]
	if (!group) {
		group = {
			name: groupName,
			path: groupPath,
			operations: [],
			consumes: [], // TODO in OpenAPIV2 these are on the document, but not on OpenAPIV3
			produces: [], // TODO in OpenAPIV2 these are on the document, but not on OpenAPIV3
		}
		groups[groupName] = group
	}

	prepareOperationForGroup(operation, group)
	group.operations.push(operation)
}

/**
 * See JavaJAXRSSpecServerCodegen.addOperationToGroup
 * @param operation 
 * @param apiInfo 
 */
export function addToGroupsByPath(operation: CodegenOperation, groups: CodegenOperationGroups, state: CodegenState): void {
	let basePath = operation.path
	
	const pos = basePath.indexOf('/', 1)
	if (pos > 0) {
		basePath = basePath.substring(0, pos)
	}

	let groupName = basePath
	if (groupName.startsWith('/')) {
		groupName = groupName.substring(1)
	}

	if (groupName === '') {
		groupName = 'default'
	}

	addToGroups(operation, groupName, basePath, groups, state)
}

export function addToGroupsByTag(operation: CodegenOperation, groups: CodegenOperationGroups, state: CodegenState): void {
	let groupName: string
	if (operation.tags && operation.tags.length) {
		groupName = operation.tags[0]
	} else {
		groupName = 'default'
	}

	addToGroups(operation, groupName, '', groups, state)
}

export function addToGroupsByTagOrPath(operation: CodegenOperation, groups: CodegenOperationGroups, state: CodegenState): void {
	if (operation.vendorExtensions && operation.vendorExtensions['x-group']) {
		return addToGroups(operation, String(operation.vendorExtensions['x-group']), '', groups, state)
	} else if (operation.tags && operation.tags.length) {
		return addToGroupsByTag(operation, groups, state)
	} else {
		return addToGroupsByPath(operation, groups, state)
	}
}

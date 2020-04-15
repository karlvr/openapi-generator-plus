import { CodegenOperation, CodegenOperationGroups, CodegenOperationGroup } from '@openapi-generator-plus/types'

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

/**
 * See JavaJAXRSSpecServerCodegen.addOperationToGroup
 * @param operationInfo 
 * @param apiInfo 
 */
export function addToGroupsByPath(operationInfo: CodegenOperation, groups: CodegenOperationGroups) {
	let basePath = operationInfo.path
	
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

	let group = groups[groupName]
	if (!group) {
		group = {
			name: groupName,
			path: basePath,
			operations: [],
			consumes: [], // TODO in OpenAPIV2 these are on the document, but not on OpenAPIV3
			produces: [], // TODO in OpenAPIV2 these are on the document, but not on OpenAPIV3
		}
		groups[groupName] = group
	}

	prepareOperationForGroup(operationInfo, group)
	group.operations.push(operationInfo)
}

export function addToGroupsByTag(operation: CodegenOperation, groups: CodegenOperationGroups) {
	let tag: string
	if (operation.tags && operation.tags.length) {
		tag = operation.tags[0]
	} else {
		tag = 'default'
	}

	let group = groups[tag]
	if (!group) {
		group = {
			name: tag,
			path: '',
			operations: [],
			consumes: [], // TODO in OpenAPIV2 these are on the document, but not on OpenAPIV3
			produces: [], // TODO in OpenAPIV2 these are on the document, but not on OpenAPIV3
		}
		groups[tag] = group
	}

	prepareOperationForGroup(operation, group)

	group.operations.push(operation)
}

export function addToGroupsByTagOrPath(operation: CodegenOperation, groups: CodegenOperationGroups) {
	if (operation.tags && operation.tags.length) {
		return addToGroupsByTag(operation, groups)
	} else {
		return addToGroupsByPath(operation, groups)
	}
}

import { CodegenOperation, CodegenOperationGroups, CodegenOperationGroup, CodegenState } from '@openapi-generator-plus/types'
import * as idx from '@openapi-generator-plus/indexed-type'

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

	let group = idx.get(groups, groupName)
	if (!group) {
		group = {
			name: groupName,
			path: groupPath,
			operations: [],
			consumes: [], // TODO in OpenAPIV2 these are on the document, but not on OpenAPIV3
			produces: [], // TODO in OpenAPIV2 these are on the document, but not on OpenAPIV3
			tags: operation.tags,
		}
		idx.set(groups, groupName, group)
	}

	prepareOperationForGroup(operation, group)
	group.operations.push(operation)

	/* Remove incompatible tags from group */
	if (group.tags) {
		group.tags = group.tags.filter(tag => operation.tags && operation.tags.indexOf(tag) !== -1)
		if (group.tags.length === 0) {
			group.tags = null
		}
	}
}

function preferredGroupMetadata(operation: CodegenOperation): { path: string; name: string } {
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

	return {
		path: basePath,
		name: groupName,
	}
}

/**
 * See JavaJAXRSSpecServerCodegen.addOperationToGroup
 * @param operation 
 * @param apiInfo 
 */
export function addToGroupsByPath(operation: CodegenOperation, groups: CodegenOperationGroups, state: CodegenState): void {
	const metadata = preferredGroupMetadata(operation)

	addToGroups(operation, metadata.name, metadata.path, groups, state)
}

export function addToGroupsByTag(operation: CodegenOperation, groups: CodegenOperationGroups, state: CodegenState): void {
	let groupName: string
	if (operation.tags && operation.tags.length) {
		groupName = operation.tags[0]
	} else {
		groupName = 'default'
	}

	const metadata = preferredGroupMetadata(operation)

	addToGroups(operation, groupName, metadata.path, groups, state)
}

export function addToGroupsByTagOrPath(operation: CodegenOperation, groups: CodegenOperationGroups, state: CodegenState): void {
	if (state.options.operations.groupBy === 'path') {
		return addToGroupsByPath(operation, groups, state)
	} else if (state.options.operations.groupBy === 'tag') {
		return addToGroupsByTag(operation, groups, state)
	}

	if (operation.vendorExtensions && operation.vendorExtensions['x-group']) {
		return addToGroups(operation, String(operation.vendorExtensions['x-group']), '', groups, state)
	} else if (operation.tags && operation.tags.length) {
		return addToGroupsByTag(operation, groups, state)
	} else {
		return addToGroupsByPath(operation, groups, state)
	}
}

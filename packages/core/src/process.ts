import { OpenAPIV2, OpenAPIV3 } from 'openapi-types'
import { CodegenDocument, CodegenOperation, CodegenOperationGroup, CodegenOperationGroups, CodegenGeneratorType, CodegenSchema, CodegenSchemas, isCodegenScope, CodegenGeneratorHelper } from '@openapi-generator-plus/types'
import { isOpenAPIV2Document, isOpenAPIV2PathItemObject, isOpenAPIV3Document, isOpenAPIV3PathItemObject } from './openapi-type-guards'
import _ from 'lodash'
import { InternalCodegenState } from './types'
import * as idx from '@openapi-generator-plus/indexed-type'
import { toCodegenServers } from './process/servers'
import { resolveReference } from './process/utils'
import { toCodegenSecurityRequirements, toCodegenSecuritySchemes } from './process/security'
import { discoverCodegenSchemas } from './process/schema'
import { toCodegenInfo } from './process/info'
import { toCodegenOperations } from './process/paths'
import { postProcessSchemaForDiscriminator } from './process/schema/discriminator'
import { toCodegenExternalDocs } from './process/external-docs'
import { createObjectSchema } from './process/schema/object'
import { createOneOfSchema } from './process/schema/one-of'
import { addToScope, scopeOf } from './process/schema/utils'

function groupOperations(operationInfos: CodegenOperation[], state: InternalCodegenState) {
	const strategy = state.generator.operationGroupingStrategy()

	const groups: CodegenOperationGroups = {}
	for (const operationInfo of operationInfos) {
		strategy(operationInfo, groups, state)
	}

	uniqueifyOperationNames(groups, state)

	return _.values(groups)
}

/**
 * Ensure that operation names are unique within a group.
 * This can be a problem if an API spec uses non-unique operationIds.
 */
function uniqueifyOperationNames(groups: CodegenOperationGroups, state: InternalCodegenState) {
	for (const name in groups) {
		const group = groups[name]
		
		const duplicateNames = findDuplicateNamesLowerCase(group.operations)

		if (duplicateNames.length > 0) {
			/* First try replacing with full names, but with path relative to this group, as we're assuming they were using operationIds
			   and they weren't unique, which is how they had this problem in the first place.
			 */
			for (const op of group.operations) {
				if (duplicateNames.indexOf(op.name.toLowerCase()) !== -1) {
					op.name = state.generator.toOperationName(op.path, op.httpMethod)
				}
			}

			/* If there are any more duplicates, we'll iterate them by appending a number */
			let newDuplicateNames = findDuplicateNamesLowerCase(group.operations)
			while (newDuplicateNames.length > 0) {
				const iterations: number[] = [0].fill(1, 0, newDuplicateNames.length)
				for (const op of group.operations) {
					const index = newDuplicateNames.indexOf(op.name.toLowerCase())
					if (index !== -1) {
						const iteration = iterations[index]++
						op.name = `${op.name}${iteration}`
					}
				}

				newDuplicateNames = findDuplicateNamesLowerCase(group.operations)
			}
		}
	}
}

function findDuplicateNamesLowerCase(operations: CodegenOperation[]): string[] {
	const seenNames = new Set<string>()
	const problemNames: string[] = []
	for (const op of operations) {
		const opNameLowerCase = op.name.toLowerCase()
		if (seenNames.has(opNameLowerCase) && problemNames.indexOf(opNameLowerCase) === -1) {
			problemNames.push(opNameLowerCase)
		}
		seenNames.add(opNameLowerCase)
	}
	return problemNames
}

function createGeneratorHelper(state: InternalCodegenState): CodegenGeneratorHelper {
	return {
		addToScope: (schema, scope) => addToScope(schema, scope, state),
		createObjectSchema: (suggestedName, scope, purpose) => createObjectSchema(suggestedName, scope, purpose, state),
		createOneOfSchema: (suggestedName, scope, purpose) => createOneOfSchema(suggestedName, scope, purpose, state),
		findSchema: (name, scope) => scope !== null ? scope.schemas != null ? idx.get(scope.schemas, name) : undefined : idx.get(state.schemas, name),
		scopeOf: (schema) => scopeOf(schema, state),
	}
}

function processCodegenDocument(doc: CodegenDocument, state: InternalCodegenState) {
	/* Process groups */
	for (let i = 0; i < doc.groups.length; i++) {
		const group = doc.groups[i]
		const result = processCodegenOperationGroup(group, state)
		if (!result) {
			doc.groups.splice(i, 1)
			i--
		}
	}

	/* Process models */
	processCodegenSchemas(doc.schemas, state)

	/* Sort groups */
	doc.groups.sort((a, b) => a.name.localeCompare(b.name))

	/* Sort schemas */
	doc.schemas = idx.sortValues(doc.schemas, (a, b) => a.name.localeCompare(b.name))

	if (state.generator.postProcessDocument) {
		state.generator.postProcessDocument(doc, createGeneratorHelper(state))
	}
}

function processCodegenOperationGroup(group: CodegenOperationGroup, state: InternalCodegenState): boolean {
	for (let i = 0; i < group.operations.length; i++) {
		const result = processCodegenOperation(group.operations[i], state)
		if (!result) {
			group.operations.splice(i, 1)
			i--
		}
	}

	/* Remove empty groups */
	if (group.operations.length === 0) {
		return false
	}

	/* Sort operations */
	group.operations.sort((a, b) => a.name.localeCompare(b.name))
	return true
}

function processCodegenSchemas(models: CodegenSchemas, state: InternalCodegenState) {
	for (const entry of idx.iterable(models)) {
		const result = processCodegenSchema(entry[1], state)
		if (!result) {
			idx.remove(models, entry[0])
		} else if (isCodegenScope(entry[1])) {
			const subModels = entry[1].schemas
			if (subModels) {
				processCodegenSchemas(subModels, state)
				if (idx.isEmpty(subModels)) {
					entry[1].schemas = null
				}
			}
		}
	}
}

function processCodegenOperation(op: CodegenOperation, state: InternalCodegenState): boolean {
	if (hasNoGenerationRule(op, state)) {
		return false
	}
	
	return true
}

function processCodegenSchema(schema: CodegenSchema, state: InternalCodegenState): boolean {
	if (hasNoGenerationRule(schema, state)) {
		return false
	}

	postProcessSchemaForDiscriminator(schema)
	
	if (state.generator.postProcessSchema) {
		const result = state.generator.postProcessSchema(schema, createGeneratorHelper(state))
		if (result === false) {
			return false
		}
	}
	return true
}

function hasNoGenerationRule(ob: CodegenOperation | CodegenSchema, state: InternalCodegenState): boolean {
	const generatorType = state.generator.generatorType()
	if (generatorType === CodegenGeneratorType.SERVER) {
		return !!(ob.vendorExtensions && ob.vendorExtensions['x-no-server'])
	} else if (generatorType === CodegenGeneratorType.CLIENT) {
		return !!(ob.vendorExtensions && ob.vendorExtensions['x-no-client'])
	} else {
		return false
	}
}

/**
 * Paths are a bit special, in that they can have a $ref and their own keys. So we need to do a special merge
 * so we can correctly traverse a chain of references and override things correctly.
 * @param pathItem 
 * @param state 
 * @returns 
 */
function mergeReferencedPathItems(pathItem: OpenAPIV2.PathItemObject | OpenAPIV3.PathItemObject, state: InternalCodegenState): OpenAPIV2.PathItemObject | OpenAPIV3.PathItemObject {
	if (pathItem.$ref) {
		const result: OpenAPIV2.PathItemObject | OpenAPIV3.PathItemObject = { ...pathItem }
		const referenceChainItem = mergeReferencedPathItems(resolveReference(pathItem, state), state)
		if (isOpenAPIV3PathItemObject(result, state.specVersion) && isOpenAPIV3PathItemObject(referenceChainItem, state.specVersion)) {
			if (!result.summary) result.summary = referenceChainItem.summary
			if (!result.description) result.description = referenceChainItem.description
			if (!result.trace) result.trace = referenceChainItem.trace
			if (!result.servers) result.servers = referenceChainItem.servers

			if (!result.parameters) {
				result.parameters = referenceChainItem.parameters
			} else if (referenceChainItem.parameters) {
				/* Merge parameters */
				result.parameters = [...result.parameters, ...referenceChainItem.parameters]
			}
		}
		if (isOpenAPIV2PathItemObject(result, state.specVersion) && isOpenAPIV2PathItemObject(referenceChainItem, state.specVersion)) {
			if (!result.parameters) {
				result.parameters = referenceChainItem.parameters
			} else if (referenceChainItem.parameters) {
				/* Merge parameters */
				result.parameters = [...result.parameters, ...referenceChainItem.parameters]
			}
		}
		
		if (!result.get) result.get = referenceChainItem.get
		if (!result.put) result.put = referenceChainItem.put
		if (!result.post) result.post = referenceChainItem.post
		if (!result.delete) result.delete = referenceChainItem.delete
		if (!result.options) result.options = referenceChainItem.options
		if (!result.head) result.head = referenceChainItem.head
		if (!result.patch) result.patch = referenceChainItem.patch
		
		return result
	} else {
		return pathItem
	}
}

export function processDocument(state: InternalCodegenState): CodegenDocument {
	const operations: CodegenOperation[] = []

	const root = state.root

	/* Process schemas first so we can check for duplicate names when creating new anonymous models */
	const specSchemas = isOpenAPIV2Document(root) ? root.definitions : isOpenAPIV3Document(root) ? root.components?.schemas : undefined
	if (specSchemas) {
		discoverCodegenSchemas(specSchemas, state)
	}

	for (const path in root.paths) {
		const pathItem: OpenAPIV2.PathItemObject | OpenAPIV3.PathItemObject = root.paths[path]!
		if (!pathItem) {
			continue
		}

		const merged = mergeReferencedPathItems(pathItem, state)
		const pathOperations = toCodegenOperations(path, merged, state)
		operations.push(...pathOperations)
	}

	const groups = groupOperations(operations, state)

	const doc: CodegenDocument = {
		info: toCodegenInfo(root.info),
		groups,
		schemas: state.schemas,
		servers: toCodegenServers(root),
		securitySchemes: toCodegenSecuritySchemes(state),
		securityRequirements: root.security ? toCodegenSecurityRequirements(root.security, state) || null : null,
		externalDocs: toCodegenExternalDocs(root),
	}

	processCodegenDocument(doc, state)
	return doc
}

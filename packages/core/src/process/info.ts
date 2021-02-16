import { CodegenContactObject, CodegenInfo, CodegenLicenseObject } from '@openapi-generator-plus/types'
import { OpenAPIV2, OpenAPIV3 } from 'openapi-types'

export function toCodegenInfo(info: OpenAPIV2.InfoObject | OpenAPIV3.InfoObject): CodegenInfo {
	return {
		title: info.title,
		description: info.description || null,
		termsOfService: info.termsOfService || null,
		contact: info.contact ? toCodegenContact(info.contact) : null,
		license: info.license ? toCodegenLicense(info.license) : null,
		version: info.version,
	}
}

function toCodegenContact(contact: OpenAPIV2.ContactObject | OpenAPIV3.ContactObject): CodegenContactObject {
	return {
		name: contact.name || null,
		email: contact.email || null,
		url: contact.url || null,
	}
}

function toCodegenLicense(license: OpenAPIV2.LicenseObject | OpenAPIV3.LicenseObject): CodegenLicenseObject {
	return {
		name: license.name,
		url: license.url || null,
	}
}

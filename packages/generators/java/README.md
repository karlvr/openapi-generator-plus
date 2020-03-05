# Java generator

## Config

|Property|Type|Description|Default|
|--------|----|-----------|-------|
|`package`|`string`|Base package name that other default package names will be based on.|`"com.example"`|
|`apiPackage`|`string`|Package for API service interfaces.|`"${package}"`|
|`apiServiceImplPackage`|`string`|Package for API service implementation classes.|`"${apiPackage}.impl"`|
|`modelPackage`|`string`|Package for API model classes.|`"${package}.model"`|
|`invokerPackage`|`string`|Package for API invoker classes.|`"${package}.app"`|
|`useBeanValidation`|`boolean`|Whether to use bean validation.|`true`|
|`dateImplementation`|`string`|Date type class.|`"java.time.LocalDate"`|
|`timeImplementation`|`string`|Time type class.|`"java.time.LocalTime"`|
|`dateTimeImplementation`|`string`|Date time type class.|`"java.time.OffsetDateTime"`|
|`constantStyle`|`"allCapsSnake"|"allCaps"|"camelCase"`|The style to use for constant naming.|`"allCapsSnake"`|
|`authenticatedOperationAnnotation`|`string`|Annotation to add to API methods that require authentication.|`undefined`|

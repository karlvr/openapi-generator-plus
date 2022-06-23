---
"@openapi-generator-plus/core": major
"@openapi-generator-plus/types": major
---

Change the default vs initial value approach by removing `initialValue` from `CodegenProperty`, replacing it with `defaultValue`, and only populating it if a default is specified in the schema.

The `initialValue` function in `CodegenGenerator` has been removed. Previously the `initialValue` function would return a value to use if there wasn't a default in the schema, leading to default values in the generated code where no default was expected.

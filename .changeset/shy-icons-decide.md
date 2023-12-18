---
"@openapi-generator-plus/core": minor
---

Always remove discriminators from object properties

Previously when the generator had introduced an _interface_—such as in some `allOf` cases when multiple-inheritance isn't supported (e.g. Java)—the discriminator properties were retained, which resulted in
inconsistent behaviour.

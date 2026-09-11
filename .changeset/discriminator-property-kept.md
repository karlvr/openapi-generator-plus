---
"@openapi-generator-plus/core": minor
"@openapi-generator-plus/types": minor
---

Keep the discriminator property in the schema that declares it

A discriminator property was previously removed from the schema that declared it. For the 
declaring schema, and for each member, the property could be found in `discriminator` or
`discriminatorValues`. However for a schema that a member inherits the property from,
the property was lost.

A schema may be used outside of its role in the discriminator hierarchy, so it's important to
retain its properties.

The property is no longer removed. `CodegenProperty.discriminators` records the
discriminators and a generator can use that to decide how to render the
property. A generator may narrow the type of the property to the member's own value, or delegate the
serialization of the property to a runtime.

This is a breaking change for generators that assumed the core removed these discriminator properties.

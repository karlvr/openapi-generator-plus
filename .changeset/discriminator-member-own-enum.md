---
"@openapi-generator-plus/core": minor
---

Build each discriminator member's value literal from the member's own property type

When the members of a discriminated `oneOf`/`anyOf` each declare their own type for the discriminator
property (for example, their own single-value enum), each member's discriminator value literal is now
built from that member's own property rather than from the discriminator's single common type.
Previously every member's literal referred to the first member's type, which does not contain the
other members' values.

---
"@openapi-generator-plus/core": patch
---

Derive a wrapper's value property and a `$ref`'d parameter's native type from the usage they end
up with.

Both adjusted a usage after its native type had been derived, so the type described the usage as
it was before the change:

- A wrapper's `value` property was created from the optional usage of the schema it wraps and then
  made required, so a generator that types `required` — Java's primitives, Swift's optionals — got
  the optional type for a value that is always present.
- A parameter reached through a `$ref` that overrides `required` was typed before the override was
  applied, so it was typed as optional while being required. The same applied to `deprecated`.

This is the same fault as the one fixed in `absorbProperties`, and generated types change for
generators whose `nativeTypeUsageTransformer` depends on `required`.

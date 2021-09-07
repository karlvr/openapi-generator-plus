---
"@openapi-generator-plus/core": patch
---

Fix using an interface's implementation as a parent in an allOf

We still absorbed the interface's properties, so we ended up duplicating the properties in
our object schema, and in our parent object schema.

This caused an issue in the Java generator as the bean validation annotations that we use
are not allowed to appear twice on the same property in an inheritance hierarchy.

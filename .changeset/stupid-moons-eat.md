---
"@openapi-generator-plus/core": patch
---

Fix handling of OAI 3.1 nullable schema references using `anyOf`

The generator did not properly use the referenced schema so it would not be generated as a top-level schema
and its name would not be used.

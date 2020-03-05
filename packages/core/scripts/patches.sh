#!/bin/bash -u

patch -p0 --forward <<EOF
--- node_modules/openapi-types/dist/index.d.ts  2020-02-01 07:41:50.000000000 +1300
+++ node_modules/openapi-types/dist/index.d.ts  2020-02-01 07:41:53.000000000 +1300
@@ -364,6 +364,7 @@
         [index: string]: any;
     }
     interface SecuritySchemeOauth2Base extends SecuritySchemeObjectBase {
+        type: 'oauth2';
         flow: 'implicit' | 'password' | 'application' | 'accessCode';
         scopes: ScopesObject;
     }
EOF

exit 0

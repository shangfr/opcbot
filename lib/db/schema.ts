*** Begin Patch
*** Update File: lib/db/schema.ts
@@
-    kind: varchar("text", { enum: ["text", "code", "image", "html", "sheet"] })
-      .notNull()
-      .default("text"),
+    kind: varchar("kind", { enum: ["text", "code", "image", "html", "sheet"] })
+      .notNull()
+      .default("text"),
*** End Patch

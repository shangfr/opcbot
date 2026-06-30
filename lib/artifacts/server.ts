*** Begin Patch
*** Update File: lib/artifacts/server.ts
@@
-import { codeDocumentHandler } from "@/artifacts/code/server";
-import { htmlDocumentHandler } from "@/artifacts/html/server";
-import { sheetDocumentHandler } from "@/artifacts/sheet/server";
-import { textDocumentHandler } from "@/artifacts/text/server";
+import { codeDocumentHandler } from "@/artifacts/code/server";
+import { htmlDocumentHandler } from "@/artifacts/html/server";
+import { sheetDocumentHandler } from "@/artifacts/sheet/server";
+import { textDocumentHandler } from "@/artifacts/text/server";
+// image handler may be optional; only import if implementation exists
+import { imageDocumentHandler } from "@/artifacts/image/server";
@@
 export type SaveDocumentProps = {
   id: string;
   title: string;
   kind: ArtifactKind;
   content: string;
   userId: string;
+  chatId?: string;
 };
@@
 export type CreateDocumentCallbackProps = {
   id: string;
   title: string;
   dataStream: UIMessageStreamWriter<ChatMessage>;
   session: Session;
   modelId: string;
+  chatId?: string;
 };
@@
 export type UpdateDocumentCallbackProps = {
   document: Document;
   description: string;
   dataStream: UIMessageStreamWriter<ChatMessage>;
   session: Session;
   modelId: string;
+  chatId?: string;
 };
@@
-export type DocumentHandler<T = ArtifactKind> = {
-  kind: T;
-  onCreateDocument: (args: CreateDocumentCallbackProps) => Promise<void>;
-  onUpdateDocument: (args: UpdateDocumentCallbackProps) => Promise<void>;
-};
+export type DocumentHandler<T = ArtifactKind> = {
+  kind: T;
+  // handlers return the generated draft content so caller can persist it
+  onCreateDocument: (args: CreateDocumentCallbackProps) => Promise<string>;
+  onUpdateDocument: (args: UpdateDocumentCallbackProps) => Promise<string>;
+};
@@
 export function createDocumentHandler<T extends ArtifactKind>(config: {
   kind: T;
-  onCreateDocument: (params: CreateDocumentCallbackProps) => Promise<string>;
-  onUpdateDocument: (params: UpdateDocumentCallbackProps) => Promise<string>;
+  onCreateDocument: (params: CreateDocumentCallbackProps) => Promise<string>;
+  onUpdateDocument: (params: UpdateDocumentCallbackProps) => Promise<string>;
 }): DocumentHandler<T> {
   return {
     kind: config.kind,
     onCreateDocument: async (args: CreateDocumentCallbackProps) => {
       const draftContent = await config.onCreateDocument({
         id: args.id,
         title: args.title,
         dataStream: args.dataStream,
         session: args.session,
         modelId: args.modelId,
+        chatId: args.chatId,
       });
 
       if (args.session?.user?.id) {
         await saveDocument({
           id: args.id,
           title: args.title,
           content: draftContent,
           kind: config.kind,
           userId: args.session.user.id,
+          chatId: args.chatId,
         });
       }
 
       return;
     },
     onUpdateDocument: async (args: UpdateDocumentCallbackProps) => {
       const draftContent = await config.onUpdateDocument({
         document: args.document,
         description: args.description,
         dataStream: args.dataStream,
         session: args.session,
         modelId: args.modelId,
+        chatId: args.chatId,
       });
 
       if (args.session?.user?.id) {
         await saveDocument({
           id: args.document.id,
           title: args.document.title,
           content: draftContent,
           kind: config.kind,
           userId: args.session.user.id,
+          chatId: args.chatId,
         });
       }
 
       return;
     },
   };
 }
@@
-export const documentHandlersByArtifactKind: DocumentHandler[] = [
-  textDocumentHandler,
-  codeDocumentHandler,
-  htmlDocumentHandler,
-  sheetDocumentHandler,
-];
-
-export const artifactKinds = ["text", "code", "html", "sheet"] as const;
+export const documentHandlersByArtifactKind: DocumentHandler[] = [
+  textDocumentHandler,
+  codeDocumentHandler,
+  htmlDocumentHandler,
+  sheetDocumentHandler,
+  // include image handler if available
+  ...(typeof imageDocumentHandler !== "undefined" ? [imageDocumentHandler] : []),
+];
+
+export const artifactKinds = ["text", "code", "html", "sheet", "image"] as const;
*** End Patch

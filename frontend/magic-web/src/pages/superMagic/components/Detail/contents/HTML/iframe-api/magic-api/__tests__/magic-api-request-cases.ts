export interface MagicRequestCase {
	method: string
	requestType: string
	args: () => unknown[]
	timeout: number
	response?: Record<string, unknown>
}

/** Independent host fixtures pin each public result extractor, not just settlement. */
export const magicSuccessCases: Record<
	string,
	{ response: Record<string, unknown>; expected: unknown }
> = {
	getAppBasePath: { response: { content: "app/" }, expected: "app/" },
	"fs.readFile": { response: { content: "file contents" }, expected: "file contents" },
	"fs.listFiles": { response: { files: ["a.txt"] }, expected: ["a.txt"] },
	"fs.listDir": {
		response: { entries: [{ name: "a.txt", path: "a.txt", isDirectory: false }] },
		expected: [{ name: "a.txt", path: "a.txt", isDirectory: false }],
	},
	"fs.getFileUrl": {
		response: { url: "https://files.example/a" },
		expected: "https://files.example/a",
	},
	"llm.getModels": { response: { models: [{ id: "model-1" }] }, expected: [{ id: "model-1" }] },
	"llm.chat": { response: { content: "answer" }, expected: "answer" },
	"agent.getAgents": {
		response: {
			agents: [{ id: "agent-1", name: "Writer", icon: "", color: "", type: "official" }],
		},
		expected: [{ id: "agent-1", name: "Writer", icon: "", color: "", type: "official" }],
	},
	"project.createTopicAndSend": {
		response: { topicId: "topic-1" },
		expected: { topicId: "topic-1" },
	},
	"project.sendMessage": { response: { content: "ignored" }, expected: undefined },
	"project.uploadFiles": {
		response: { results: [{ filename: "a", success: true }] },
		expected: [{ filename: "a", success: true }],
	},
	"project.addFilesToMessage": {
		response: { result: { foundCount: 1, notFoundPaths: [] } },
		expected: { foundCount: 1, notFoundPaths: [] },
	},
	"project.downloadFiles": {
		response: { result: { successCount: 1, failedCount: 0 } },
		expected: { successCount: 1, failedCount: 0 },
	},
	"user.getInfo": {
		response: { userInfo: { name: "Alice", avatar: "avatar.png" } },
		expected: { name: "Alice", avatar: "avatar.png" },
	},
	"context.getContext": {
		response: {
			content: {
				userId: "user-1",
				userName: "Alice",
				user: { user_id: "user-1" },
				organizationCode: "org-1",
				language: "zh_CN",
			},
		},
		expected: {
			userId: "user-1",
			userName: "Alice",
			user: { user_id: "user-1" },
			organizationCode: "org-1",
			language: "zh_CN",
		},
	},
	"db.getTables": { response: { content: [{ id: "table-1" }] }, expected: [{ id: "table-1" }] },
	"db.getProjectAdminAccess": {
		response: { content: { project_id: "project-1", is_admin: false } },
		expected: { project_id: "project-1", is_admin: false },
	},
	"db.getTable": {
		response: { content: { id: "table-1", fields: [] } },
		expected: { id: "table-1", fields: [] },
	},
	"db.createRow": {
		response: { content: { id: "row-1", name: "Alice" } },
		expected: { id: "row-1", name: "Alice" },
	},
	"db.queryRows": {
		response: { content: { items: [{ id: "row-1" }] } },
		expected: { items: [{ id: "row-1" }] },
	},
	"db.getRow": { response: { content: { id: "row-1" } }, expected: { id: "row-1" } },
	"db.updateRow": {
		response: { content: { id: "row-1", name: "Bob" } },
		expected: { id: "row-1", name: "Bob" },
	},
	"db.deleteRow": { response: { content: "ignored" }, expected: undefined },
	"db.getRelations": {
		response: { content: [{ id: "relation-1" }] },
		expected: [{ id: "relation-1" }],
	},
}

// FS mutation APIs promise completion only; the old runtime currently returns an
// envelope. Do not turn that accidental return value into a public API guarantee.
export const completionOnlyMethods = new Set([
	"fs.writeFile",
	"fs.deleteFile",
	"fs.deleteDir",
	"fs.moveFile",
	"fs.renameFile",
])

/** All Promise-based public operations, including the separate binary write protocol. */
export const magicRequestCases: MagicRequestCase[] = [
	{
		method: "getAppBasePath",
		requestType: "MAGIC_FS_GET_APP_BASE_PATH_REQUEST",
		args: () => [],
		timeout: 15000,
	},
	{
		method: "fs.readFile",
		requestType: "MAGIC_FS_READ_REQUEST",
		args: () => ["./a.txt"],
		timeout: 15000,
	},
	{
		method: "fs.writeFile",
		requestType: "MAGIC_FS_WRITE_REQUEST",
		args: () => ["./a.txt", "text"],
		timeout: 15000,
	},
	{
		method: "fs.writeFile",
		requestType: "MAGIC_FS_WRITE_BLOB_REQUEST",
		args: () => ["./a.bin", new Blob(["binary"])],
		timeout: 60000,
	},
	{
		method: "fs.listFiles",
		requestType: "MAGIC_FS_LIST_REQUEST",
		args: () => [],
		timeout: 15000,
	},
	{
		method: "fs.listDir",
		requestType: "MAGIC_FS_LIST_DIR_REQUEST",
		args: () => [],
		timeout: 15000,
	},
	{
		method: "fs.getFileUrl",
		requestType: "MAGIC_FS_GET_FILE_URL_REQUEST",
		args: () => ["./a.txt"],
		timeout: 15000,
	},
	{
		method: "fs.deleteFile",
		requestType: "MAGIC_FS_DELETE_FILE_REQUEST",
		args: () => ["./a.txt"],
		timeout: 15000,
	},
	{
		method: "fs.deleteDir",
		requestType: "MAGIC_FS_DELETE_DIR_REQUEST",
		args: () => ["./dir"],
		timeout: 15000,
	},
	{
		method: "fs.moveFile",
		requestType: "MAGIC_FS_MOVE_FILE_REQUEST",
		args: () => ["./a.txt", "./dir"],
		timeout: 15000,
	},
	{
		method: "fs.renameFile",
		requestType: "MAGIC_FS_RENAME_FILE_REQUEST",
		args: () => ["./a.txt", "b.txt"],
		timeout: 15000,
	},
	{
		method: "llm.getModels",
		requestType: "MAGIC_LLM_GET_MODELS_REQUEST",
		args: () => [],
		timeout: 30000,
	},
	{
		method: "llm.chat",
		requestType: "MAGIC_LLM_CHAT_REQUEST",
		args: () => [[{ role: "user", content: "Hello" }]],
		timeout: 120000,
	},
	{
		method: "agent.getAgents",
		requestType: "MAGIC_GET_AGENTS_REQUEST",
		args: () => [],
		timeout: 15000,
	},
	{
		method: "project.createTopicAndSend",
		requestType: "MAGIC_CREATE_TOPIC_AND_SEND_REQUEST",
		args: () => ["Hello"],
		timeout: 30000,
	},
	{
		method: "project.sendMessage",
		requestType: "MAGIC_SEND_MESSAGE_REQUEST",
		args: () => ["Hello"],
		timeout: 15000,
	},
	{
		method: "project.uploadFiles",
		requestType: "MAGIC_UPLOAD_FILES_REQUEST",
		args: () => [[{ file: new Blob(["data"]), path: "./a", filename: "a" }]],
		timeout: 60000,
	},
	{
		method: "project.addFilesToMessage",
		requestType: "MAGIC_ADD_FILES_TO_MESSAGE_REQUEST",
		args: () => [["./a"]],
		timeout: 15000,
	},
	{
		method: "project.downloadFiles",
		requestType: "MAGIC_DOWNLOAD_FILES_REQUEST",
		args: () => [["./a"]],
		timeout: 30000,
	},
	{
		method: "user.getInfo",
		requestType: "MAGIC_GET_USER_INFO_REQUEST",
		args: () => [],
		timeout: 15000,
	},
	{
		method: "context.getContext",
		requestType: "MAGIC_CONTEXT_GET_REQUEST",
		args: () => [],
		timeout: 15000,
		response: {
			content: {
				userId: "user-1",
				userName: "Alice",
				user: { user_id: "user-1" },
				organizationCode: "org-1",
				language: "zh_CN",
			},
		},
	},
	{
		method: "db.getTables",
		requestType: "MAGIC_DB_GET_TABLES_REQUEST",
		args: () => [],
		timeout: 15000,
	},
	{
		method: "db.getProjectAdminAccess",
		requestType: "MAGIC_DB_GET_PROJECT_ADMIN_ACCESS_REQUEST",
		args: () => [],
		timeout: 15000,
		response: { content: { project_id: "project-1", is_admin: false } },
	},
	{
		method: "db.getTable",
		requestType: "MAGIC_DB_GET_TABLE_REQUEST",
		args: () => ["table-1"],
		timeout: 15000,
	},
	{
		method: "db.createRow",
		requestType: "MAGIC_DB_CREATE_ROW_REQUEST",
		args: () => ["table-1", { name: "Alice" }],
		timeout: 15000,
	},
	{
		method: "db.queryRows",
		requestType: "MAGIC_DB_QUERY_ROWS_REQUEST",
		args: () => ["table-1", {}],
		timeout: 30000,
	},
	{
		method: "db.getRow",
		requestType: "MAGIC_DB_GET_ROW_REQUEST",
		args: () => ["table-1", "row-1"],
		timeout: 15000,
	},
	{
		method: "db.updateRow",
		requestType: "MAGIC_DB_UPDATE_ROW_REQUEST",
		args: () => ["table-1", "row-1", { name: "Bob" }],
		timeout: 15000,
	},
	{
		method: "db.deleteRow",
		requestType: "MAGIC_DB_DELETE_ROW_REQUEST",
		args: () => ["table-1", "row-1"],
		timeout: 15000,
	},
	{
		method: "db.getRelations",
		requestType: "MAGIC_DB_GET_RELATIONS_REQUEST",
		args: () => [],
		timeout: 15000,
	},
]

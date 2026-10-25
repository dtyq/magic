/** superMagic 后端 API 错误码 */
export enum SuperMagicApiErrorCode {
	/** 文件/目录已存在 */
	DuplicateFile = 51168,
	/** 微应用对应项目无访问权限 */
	ProjectAccessDenied = 51202,
	/** 话题不存在 */
	TopicNotFound = 51050,
	/** 话题正在被其他操作占用 */
	TopicOperationBusy = 51052,
	/** 无权访问话题 */
	TopicAccessDenied = 51053,
	/** 沙盒不存在 */
	SandboxNotFound = 32007,
}

/** 判断错误是否表示微应用对应项目无访问权限 */
export function isProjectAccessDeniedError(error: unknown): boolean {
	if (!error || typeof error !== "object") return false

	const code = (error as { code?: unknown }).code
	return code === SuperMagicApiErrorCode.ProjectAccessDenied
}

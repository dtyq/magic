import type { ProviderModelPermissionScope } from "@magic-admin-v2/features/platform-model-list/utils/data-source"

/** 开源构建没有工作区模型权限。企业 Overlay 会替换本文件。 */
export const editionProviderModelPermissions: Partial<
	Record<ProviderModelPermissionScope, { edit: string; query: string }>
> = {}

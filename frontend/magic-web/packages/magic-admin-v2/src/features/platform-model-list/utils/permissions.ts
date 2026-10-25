import { PERMISSION_KEY_MAP } from "@magic-admin-v2/constants/permissions"
import type { ProviderModelPermissionScope } from "@magic-admin-v2/features/platform-model-list/utils/data-source"
import { editionProviderModelPermissions } from "@magic-admin-v2/features/platform-model-list/utils/edition-permissions"
import {
	providerModelCategory,
	providerModelType,
	type ProviderModelCategory,
	type ProviderModelGroup,
} from "@magic-admin-v2/features/platform-model-list/types"
import { hasMagicRights } from "@magic-admin-v2/permissions/rights"
import type { AccessContext } from "@magic-admin-v2/runtime/types"

export type ProviderModelCategoryAccess = {
	canEdit: boolean
	canView: boolean
}

export type ProviderModelCategoryAccessMap = Record<
	ProviderModelCategory,
	ProviderModelCategoryAccess
>

export const providerModelCategoryOrder = [
	providerModelCategory.llm,
	providerModelCategory.vlm,
	providerModelCategory.vgm,
	providerModelCategory.embedding,
] as const satisfies readonly ProviderModelCategory[]

const platformProviderModelPermissions = {
	query: PERMISSION_KEY_MAP.PLATFORM_MODEL_MANAGEMENT_QUERY,
	edit: PERMISSION_KEY_MAP.PLATFORM_MODEL_MANAGEMENT_EDIT,
}

function getProviderModelPermissions(scope: ProviderModelPermissionScope) {
	if (scope === "platform") return platformProviderModelPermissions
	return editionProviderModelPermissions[scope]
}

export function getProviderModelCategoryAccess(
	access: AccessContext | null | undefined,
	scope: ProviderModelPermissionScope,
): ProviderModelCategoryAccessMap {
	const permissions = getProviderModelPermissions(scope)
	const canEdit = Boolean(access && permissions && hasMagicRights(access, [permissions.edit]))
	const canView =
		canEdit || Boolean(access && permissions && hasMagicRights(access, [permissions.query]))

	return Object.fromEntries(
		providerModelCategoryOrder.map((category) => [category, { canEdit, canView }]),
	) as ProviderModelCategoryAccessMap
}

export function getAccessibleProviderModelCategories(
	categoryAccess: ProviderModelCategoryAccessMap,
): ProviderModelCategory[] {
	return providerModelCategoryOrder.filter((category) => categoryAccess[category].canView)
}

export function getEditableProviderModelCategories(
	categoryAccess: ProviderModelCategoryAccessMap,
): ProviderModelCategory[] {
	return providerModelCategoryOrder.filter((category) => categoryAccess[category].canEdit)
}

export function getProviderModelAccessCategory(
	model: Pick<ProviderModelGroup, "category" | "model_type">,
): ProviderModelCategory {
	return model.model_type === providerModelType.embedding
		? providerModelCategory.embedding
		: model.category
}

export function toProviderModelApiCategories(
	categories: readonly ProviderModelCategory[],
): ProviderModelCategory[] {
	return Array.from(
		new Set(
			categories.map((category) =>
				category === providerModelCategory.embedding ? providerModelCategory.llm : category,
			),
		),
	)
}

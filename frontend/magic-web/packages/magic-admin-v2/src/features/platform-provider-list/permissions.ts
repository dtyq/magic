import { PERMISSION_KEY_MAP } from "@magic-admin-v2/constants/permissions"
import {
	providerCategory,
	providerType,
	type ProviderCategory,
	type ProviderListItem,
} from "@magic-admin-v2/features/platform-provider-list/types"
import { hasMagicRights } from "@magic-admin-v2/permissions/rights"
import type { AccessContext } from "@magic-admin-v2/runtime/types"

export type ProviderCategoryAccess = {
	canEdit: boolean
	canView: boolean
}

export type ProviderCategoryAccessMap = Record<ProviderCategory, ProviderCategoryAccess>

export type ProviderCategoryPermissions = { edit: string; query: string }

/** 服务商分类顺序与旧版模型管理页保持一致。 */
export const providerCategoryOrder = [
	providerCategory.llm,
	providerCategory.vlm,
	providerCategory.vgm,
] as const satisfies readonly ProviderCategory[]

export function getProviderCategoryAccessByPermission(
	access: AccessContext | null | undefined,
	permissions: ProviderCategoryPermissions,
): ProviderCategoryAccessMap {
	const canEdit = access ? hasMagicRights(access, [permissions.edit]) : false
	const canView = canEdit || (access ? hasMagicRights(access, [permissions.query]) : false)

	return Object.fromEntries(
		providerCategoryOrder.map((category) => [category, { canEdit, canView }]),
	) as ProviderCategoryAccessMap
}

export function getProviderCategoryAccess(
	access?: AccessContext | null,
): ProviderCategoryAccessMap {
	return getProviderCategoryAccessByPermission(access, {
		query: PERMISSION_KEY_MAP.PLATFORM_MODEL_MANAGEMENT_QUERY,
		edit: PERMISSION_KEY_MAP.PLATFORM_MODEL_MANAGEMENT_EDIT,
	})
}

export function getAccessibleProviderCategories(
	categoryAccess: ProviderCategoryAccessMap,
): ProviderCategory[] {
	return providerCategoryOrder.filter((category) => categoryAccess[category].canView)
}

export function getEditableProviderCategories(
	categoryAccess: ProviderCategoryAccessMap,
): ProviderCategory[] {
	return providerCategoryOrder.filter((category) => categoryAccess[category].canEdit)
}

/** 新版统一规则：有分类编辑权限且不是官方服务商时，允许删除。 */
export function canDeleteProvider(
	categoryAccess: ProviderCategoryAccessMap,
	provider: Pick<ProviderListItem, "category" | "provider_type">,
) {
	return (
		(categoryAccess[provider.category]?.canEdit ?? false) &&
		provider.provider_type !== providerType.official
	)
}

export function resolveProviderCategory(
	selectedCategory: ProviderCategory | null,
	accessibleCategories: readonly ProviderCategory[],
): ProviderCategory | null {
	if (selectedCategory && accessibleCategories.includes(selectedCategory)) {
		return selectedCategory
	}

	return accessibleCategories[0] ?? null
}

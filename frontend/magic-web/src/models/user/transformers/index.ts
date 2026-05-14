import type { StructureUserItem } from "@/types/organization"
import type { User } from "@/types/user"

/** 可交给 userTransformer 的输入：接口 `StructureUserItem` 或 store 内 `User.UserInfo`（含乐观浅补丁）。 */
export type UserInfoTransformerInput = StructureUserItem | User.UserInfo

/**
 * 从头像相关字段解析展示用 URL：OpenAPI 实体为 `avatar_url`，而 `User.UserInfo` 存的是 `avatar`；
 * 乐观更新、MobX 回传对象往往只带后者，若只读 `avatar_url` 会把头像清空并触发头像组件重复加载。
 */
function resolveAvatarUrlFromPayload(
	userInfo: Partial<StructureUserItem> & { avatar?: string },
): string | undefined {
	if (userInfo.avatar_url != null && userInfo.avatar_url !== "") return userInfo.avatar_url
	if (userInfo.avatar != null && userInfo.avatar !== "") return userInfo.avatar
	return undefined
}

/**
 * 将接口或本地补丁中的用户结构转换为 `UserStore` 使用的 `User.UserInfo`。
 * @param base 当前内存中的用户信息；`PATCH /users/me` 等常只返回变更字段，与 base 合并可避免头像、昵称等被 undefined 覆盖。
 */
export function userTransformer(
	userInfo: UserInfoTransformerInput,
	base: User.UserInfo | null = null,
): User.UserInfo {
	const avatar =
		resolveAvatarUrlFromPayload(userInfo as Partial<StructureUserItem> & { avatar?: string }) ??
		base?.avatar ??
		""

	const preferences =
		userInfo.preferences !== undefined
			? userInfo.preferences === null
				? null
				: {
						show_follow_up_suggestions:
							userInfo.preferences.show_follow_up_suggestions ??
							base?.preferences?.show_follow_up_suggestions ??
							true,
						keep_used_follow_up_suggestions:
							userInfo.preferences.keep_used_follow_up_suggestions ??
							base?.preferences?.keep_used_follow_up_suggestions ??
							true,
					}
			: (base?.preferences ?? null)

	return {
		magic_id: userInfo?.magic_id ?? base?.magic_id ?? "",
		user_id: userInfo?.user_id ?? base?.user_id ?? "",
		status: userInfo?.status ?? base?.status ?? "",
		nickname: userInfo?.nickname ?? base?.nickname ?? "",
		real_name: userInfo?.real_name ?? base?.real_name ?? "",
		avatar,
		organization_code: userInfo?.organization_code ?? base?.organization_code ?? "",
		phone: userInfo?.phone ?? base?.phone,
		email: userInfo?.email ?? base?.email,
		country_code: userInfo?.country_code ?? base?.country_code,
		timezone: userInfo?.timezone !== undefined ? userInfo.timezone : base?.timezone,
		preferences,
	}
}

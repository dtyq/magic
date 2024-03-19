import type { StructureUserItem } from "@/opensource/types/organization"
import type { User } from "@/opensource/types/user"

export function userTransformer(userInfo: StructureUserItem): User.UserInfo {
	return {
		magic_id: userInfo?.magic_id,
		user_id: userInfo?.user_id,
		status: userInfo?.status,
		nickname: userInfo?.nickname,
		real_name: userInfo?.real_name,
		avatar: userInfo?.avatar_url,
		organization_code: userInfo?.organization_code,
		phone: userInfo?.phone,
		email: userInfo?.email,
		country_code: userInfo?.country_code,
	}
}

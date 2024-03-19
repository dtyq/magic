import type { PromptCard } from "@/opensource/pages/explore/components/PromptCard/types"
import { Admin } from "./admin"

export interface SquareData {
	popular: PromptCard[]
	latest: PromptCard[]
}
export type Friend = {
	id: string
	user_id: string
	user_organization_code: string
	friend_id: string
	friend_organization_code: string
	remarks: string
	extra: string
	status: number
	created_at: string
	updated_at: string
	deleted_at: string | null
	friend_type: number
}

/**
 * @description 我的组织
 * @interface MyOrganization
 * @property {string} magic_organization_code - 组织编码
 * @property {string} name - 组织名称
 * @property {number} organization_type - 组织类型
 * @property {string} logo - 组织Logo
 * @property {boolean} is_current - 是否当前组织
 * @property {boolean} is_admin - 是否管理员
 * @property {boolean} is_creator - 是否创建者
 */
export interface MyOrganization {
	magic_organization_code: string
	name: string
	organization_type: number
	logo: string
	is_current: boolean
	is_admin: boolean
	is_creator: boolean
	seats?: number
	subscription_tier?: Admin.SubscriptionTier
	product_name?: string
	plan_type?: Admin.PlanType
}

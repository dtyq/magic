import { describe, expect, it } from "vitest"
import { ShareType } from "../../types"
import {
	canCreateShareType,
	isFreePlanFromSubscription,
	isShareTypePlanDisabled,
	isShareTypePlanHidden,
	pickDefaultShareType,
} from "../sharePlanRestrictions"

describe("sharePlanRestrictions", () => {
	describe("isFreePlanFromSubscription", () => {
		it("只把明确的 is_paid_plan=false 当作免费计划", () => {
			expect(isFreePlanFromSubscription({ is_paid_plan: false })).toBe(true)
			expect(isFreePlanFromSubscription({ is_paid_plan: true })).toBe(false)
		})

		it("订阅信息缺失时视为未知（按付费处理），避免加载中把收费能力锁掉", () => {
			expect(isFreePlanFromSubscription(undefined)).toBe(false)
			expect(isFreePlanFromSubscription(null)).toBe(false)
			expect(isFreePlanFromSubscription({})).toBe(false)
		})
	})

	describe("isShareTypePlanDisabled", () => {
		it("免费计划的密码保护为计划禁用", () => {
			expect(isShareTypePlanDisabled(ShareType.PasswordProtected, true)).toBe(true)
		})

		it("付费计划或其它方式都不是计划禁用", () => {
			expect(isShareTypePlanDisabled(ShareType.PasswordProtected, false)).toBe(false)
			expect(isShareTypePlanDisabled(ShareType.Public, true)).toBe(false)
			expect(isShareTypePlanDisabled(ShareType.Organization, true)).toBe(false)
		})
	})

	describe("isShareTypePlanHidden", () => {
		it("只有免费计划的团队内分享会被整项隐藏", () => {
			expect(isShareTypePlanHidden(ShareType.Organization, true)).toBe(true)
			expect(isShareTypePlanHidden(ShareType.Organization, false)).toBe(false)
			expect(isShareTypePlanHidden(ShareType.Public, true)).toBe(false)
			expect(isShareTypePlanHidden(ShareType.PasswordProtected, true)).toBe(false)
		})
	})

	describe("canCreateShareType", () => {
		it("免费计划只能创建公开访问", () => {
			expect(canCreateShareType(ShareType.Public, true)).toBe(true)
			expect(canCreateShareType(ShareType.PasswordProtected, true)).toBe(false)
			expect(canCreateShareType(ShareType.Organization, true)).toBe(false)
		})

		it("付费计划三种方式都可以创建", () => {
			expect(canCreateShareType(ShareType.Public, false)).toBe(true)
			expect(canCreateShareType(ShareType.PasswordProtected, false)).toBe(true)
			expect(canCreateShareType(ShareType.Organization, false)).toBe(true)
		})
	})

	describe("pickDefaultShareType", () => {
		it("付费计划沿用列表顺序的第一个可用方式（密码保护优先）", () => {
			expect(
				pickDefaultShareType(
					[ShareType.PasswordProtected, ShareType.Public, ShareType.Organization],
					false,
				),
			).toBe(ShareType.PasswordProtected)
		})

		it("免费计划跳过密码保护，落回公开访问", () => {
			expect(
				pickDefaultShareType(
					[ShareType.PasswordProtected, ShareType.Public, ShareType.Organization],
					true,
				),
			).toBe(ShareType.Public)
		})

		it("管理员只放开团队内分享时免费计划没有可用方式，交给调用方保留当前值", () => {
			expect(pickDefaultShareType([ShareType.Organization], true)).toBeUndefined()
			expect(pickDefaultShareType([ShareType.PasswordProtected], true)).toBeUndefined()
			expect(pickDefaultShareType([], true)).toBeUndefined()
		})

		it("不会凭空造出管理员没放开的方式", () => {
			expect(pickDefaultShareType([ShareType.Organization], false)).toBe(
				ShareType.Organization,
			)
			expect(pickDefaultShareType([ShareType.PasswordProtected], false)).toBe(
				ShareType.PasswordProtected,
			)
		})
	})
})

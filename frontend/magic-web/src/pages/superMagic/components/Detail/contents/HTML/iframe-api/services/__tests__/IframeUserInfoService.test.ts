import { describe, expect, it, vi } from "vitest"
import { USER_INFO_MESSAGE_TYPES, USER_INFO_SCOPES } from "../../types"
import { IframeUserInfoService, type IframeUserInfoConfig } from "../IframeUserInfoService"

function createService(overrides?: Partial<IframeUserInfoConfig>) {
	const postToIframe = vi.fn()
	const cfg: IframeUserInfoConfig = {
		postToIframe,
		getUserInfo: () => null,
		...overrides,
	}
	const service = new IframeUserInfoService(cfg)
	return { service, postToIframe }
}

describe("IframeUserInfoService", () => {
	const fullUserInfo = {
		user_id: "user-1",
		magic_id: "magic-1",
		nickname: "Nick",
		real_name: "Real Name",
		name: "Display Name",
		avatar: "https://example.com/avatar.png",
		organization_code: "org-1",
	}

	it("returns only display-safe user fields by default", async () => {
		const { service, postToIframe } = createService({
			getUserInfo: () => fullUserInfo,
		})

		await service.handleMessage(USER_INFO_MESSAGE_TYPES.GET_USER_INFO_REQUEST, {
			type: USER_INFO_MESSAGE_TYPES.GET_USER_INFO_REQUEST,
			requestId: "req-user-info",
		})

		expect(postToIframe).toHaveBeenCalledWith({
			type: USER_INFO_MESSAGE_TYPES.GET_USER_INFO_RESPONSE,
			requestId: "req-user-info",
			success: true,
			userInfo: {
				name: "Display Name",
				avatar: "https://example.com/avatar.png",
			},
		})
	})

	it("rejects sensitive scopes that are not declared in app config", async () => {
		const authorizeUserInfo = vi.fn().mockResolvedValue(true)
		const { service, postToIframe } = createService({
			getUserInfo: () => fullUserInfo,
			authorizeUserInfo,
			appConfig: {
				name: "Unsafe App",
				permissions: {
					userInfo: {
						scopes: [USER_INFO_SCOPES.DISPLAY],
					},
				},
			},
		})

		await service.handleMessage(USER_INFO_MESSAGE_TYPES.GET_USER_INFO_REQUEST, {
			type: USER_INFO_MESSAGE_TYPES.GET_USER_INFO_REQUEST,
			requestId: "req-identity",
			scopes: [USER_INFO_SCOPES.IDENTITY],
		})

		expect(authorizeUserInfo).not.toHaveBeenCalled()
		expect(postToIframe).toHaveBeenCalledWith({
			type: USER_INFO_MESSAGE_TYPES.GET_USER_INFO_RESPONSE,
			requestId: "req-identity",
			success: false,
			error: "User info scope is not declared by this app: user.profile.identity",
		})
	})

	it("prompts once for declared sensitive scopes and returns scoped fields", async () => {
		const authorizeUserInfo = vi.fn().mockResolvedValue(true)
		const { service, postToIframe } = createService({
			getUserInfo: () => fullUserInfo,
			authorizeUserInfo,
			appConfig: {
				name: "Profile Card",
				permissions: {
					userInfo: {
						scopes: [USER_INFO_SCOPES.IDENTITY],
						reason: "展示个人名片",
					},
				},
			},
		})

		const request = {
			type: USER_INFO_MESSAGE_TYPES.GET_USER_INFO_REQUEST,
			requestId: "req-identity",
			scopes: [USER_INFO_SCOPES.IDENTITY],
		}
		await service.handleMessage(USER_INFO_MESSAGE_TYPES.GET_USER_INFO_REQUEST, request)
		await service.handleMessage(USER_INFO_MESSAGE_TYPES.GET_USER_INFO_REQUEST, {
			...request,
			requestId: "req-identity-again",
		})

		expect(authorizeUserInfo).toHaveBeenCalledOnce()
		expect(authorizeUserInfo).toHaveBeenCalledWith({
			appName: "Profile Card",
			fields: ["用户 ID", "Magic ID"],
			reason: "展示个人名片",
			scopes: [USER_INFO_SCOPES.IDENTITY],
		})
		expect(postToIframe).toHaveBeenNthCalledWith(1, {
			type: USER_INFO_MESSAGE_TYPES.GET_USER_INFO_RESPONSE,
			requestId: "req-identity",
			success: true,
			userInfo: {
				name: "Display Name",
				avatar: "https://example.com/avatar.png",
				user_id: "user-1",
				magic_id: "magic-1",
			},
		})
		expect(postToIframe).toHaveBeenNthCalledWith(2, {
			type: USER_INFO_MESSAGE_TYPES.GET_USER_INFO_RESPONSE,
			requestId: "req-identity-again",
			success: true,
			userInfo: {
				name: "Display Name",
				avatar: "https://example.com/avatar.png",
				user_id: "user-1",
				magic_id: "magic-1",
			},
		})
	})

	it("rejects when the user denies authorization", async () => {
		const { service, postToIframe } = createService({
			getUserInfo: () => fullUserInfo,
			authorizeUserInfo: vi.fn().mockResolvedValue(false),
			appConfig: {
				name: "Profile Card",
				permissions: {
					userInfo: {
						scopes: [USER_INFO_SCOPES.ORGANIZATION],
					},
				},
			},
		})

		await service.handleMessage(USER_INFO_MESSAGE_TYPES.GET_USER_INFO_REQUEST, {
			type: USER_INFO_MESSAGE_TYPES.GET_USER_INFO_REQUEST,
			requestId: "req-org",
			scopes: [USER_INFO_SCOPES.ORGANIZATION],
		})

		expect(postToIframe).toHaveBeenCalledWith({
			type: USER_INFO_MESSAGE_TYPES.GET_USER_INFO_RESPONSE,
			requestId: "req-org",
			success: false,
			error: "User denied access to requested profile fields",
		})
	})
})

/**
 * MagicUserApi
 *
 * 向 iframe 内注入用户信息 API：
 *   - window.Magic.user.getInfo() — 获取当前登录用户的展示信息（头像、姓名等）
 *
 * 所有操作通过 postMessage 委托给主站（parent window）处理。
 */

import { MagicBaseApi } from "./MagicBaseApi"
import { MagicApiLogger } from "./MagicApiLogger"

export interface MagicUserInfo {
	/** 展示用名称 */
	name: string
	/** 头像 URL */
	avatar: string
	/** 昵称（需授权 user.profile.name） */
	nickname?: string
	/** 真实姓名（需授权 user.profile.name） */
	real_name?: string
	/** 用户 ID（需授权 user.profile.identity） */
	user_id?: string
	/** Magic 全局唯一 ID（需授权 user.profile.identity） */
	magic_id?: string
	/** 当前组织编码（需授权 user.profile.organization） */
	organization_code?: string
}

export type MagicUserInfoScope =
	| "user.profile.display"
	| "user.profile.name"
	| "user.profile.identity"
	| "user.profile.organization"

export interface MagicUserInfoOptions {
	scopes?: MagicUserInfoScope[]
	reason?: string
}

export class MagicUserApi extends MagicBaseApi {
	install(): void {
		if (!window.Magic) window.Magic = {}
		MagicApiLogger.info("MagicUserApi", "install")
		this.installGetInfo()
	}

	private installGetInfo(): void {
		const getInfoFn = (options: MagicUserInfoOptions = {}): Promise<MagicUserInfo> => {
			MagicApiLogger.info("MagicUserApi", "getInfo:start")
			const payload: Record<string, unknown> = {}
			if (options.scopes !== undefined) payload.scopes = options.scopes
			if (options.reason !== undefined) payload.reason = options.reason

			return this.request<MagicUserInfo>(
				"MAGIC_GET_USER_INFO_REQUEST",
				payload,
				15000,
				(data) => data["userInfo"] as MagicUserInfo,
			)
		}

		window.Magic.user = {
			...window.Magic.user,
			getInfo: getInfoFn,
		}
	}
}

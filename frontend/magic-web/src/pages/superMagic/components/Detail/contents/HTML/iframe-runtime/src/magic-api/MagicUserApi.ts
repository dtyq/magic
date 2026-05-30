/**
 * MagicUserApi
 *
 * 向 iframe 内注入用户信息 API：
 *   - window.Magic.user.getInfo() — 获取当前登录用户的基础信息（头像、姓名等）
 *
 * 所有操作通过 postMessage 委托给主站（parent window）处理。
 */

import { MagicBaseApi } from "./MagicBaseApi"
import { MagicApiLogger } from "./MagicApiLogger"

export interface MagicUserInfo {
    /** 用户 ID */
    user_id: string
    /** Magic 全局唯一 ID */
    magic_id: string
    /** 昵称 */
    nickname: string
    /** 真实姓名 */
    real_name: string
    /** 展示用名称（real_name 优先，不存在则 nickname） */
    name: string
    /** 头像 URL */
    avatar: string
    /** 当前组织编码 */
    organization_code: string
}

export class MagicUserApi extends MagicBaseApi {
    install(): void {
        if (!window.Magic) window.Magic = {}
        if (!window.Magic.user) window.Magic.user = {}
        MagicApiLogger.info("MagicUserApi", "install")
        this.installGetInfo()
    }

    private installGetInfo(): void {
        const getInfoFn = (): Promise<MagicUserInfo> => {
            MagicApiLogger.info("MagicUserApi", "getInfo:start")
            return this.request<MagicUserInfo>(
                "MAGIC_GET_USER_INFO_REQUEST",
                {},
                15000,
                (data) => data["userInfo"] as MagicUserInfo,
            )
        }

        window.Magic.user!.getInfo = getInfoFn
    }
}

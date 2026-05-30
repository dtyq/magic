/**
 * IframeUserInfoService
 *
 * 处理 MAGIC_GET_USER_INFO_* 消息，向 iframe 提供当前登录用户的基础信息
 * （头像、昵称、姓名等），便于 app 展示与表单默认值填充。
 * 纯 class，不依赖 React，由 useIframeUserInfo hook 持有实例。
 */

import {
    USER_INFO_MESSAGE_TYPES,
    type UserInfoGetRequest,
    type UserInfo,
} from "../types"

export interface IframeUserInfoConfig {
    /** 向 iframe 发送消息的函数 */
    postToIframe: (message: object) => void
    /** 获取当前用户信息的函数 */
    getUserInfo: () => UserInfo | null
}

export class IframeUserInfoService {
    private readonly cfg: IframeUserInfoConfig

    constructor(cfg: IframeUserInfoConfig) {
        this.cfg = cfg
    }

    /**
     * 主路由入口，由 useIframeUserInfo → IsolatedHTMLRenderer 的 handleMessage 调用。
     * 返回 true 表示消息已被处理。
     */
    async handleMessage(type: string, payload: unknown): Promise<boolean> {
        if (type === USER_INFO_MESSAGE_TYPES.GET_USER_INFO_REQUEST) {
            await this.handleGetUserInfo(payload as UserInfoGetRequest)
            return true
        }
        return false
    }

    private async handleGetUserInfo(req: UserInfoGetRequest): Promise<void> {
        try {
            const userInfo = this.cfg.getUserInfo()
            if (!userInfo) {
                this.cfg.postToIframe({
                    type: USER_INFO_MESSAGE_TYPES.GET_USER_INFO_RESPONSE,
                    requestId: req.requestId,
                    success: false,
                    error: "User info is not available",
                })
                return
            }
            this.cfg.postToIframe({
                type: USER_INFO_MESSAGE_TYPES.GET_USER_INFO_RESPONSE,
                requestId: req.requestId,
                success: true,
                userInfo,
            })
        } catch (error) {
            this.cfg.postToIframe({
                type: USER_INFO_MESSAGE_TYPES.GET_USER_INFO_RESPONSE,
                requestId: req.requestId,
                success: false,
                error: error instanceof Error ? error.message : "Failed to get user info",
            })
        }
    }

    destroy(): void {
        // No cleanup needed currently
    }
}

/**
 * useIframeUserInfo
 *
 * 管理 IframeUserInfoService 的生命周期，将其挂载到 IsolatedHTMLRenderer 的
 * handleMessage 分发链中。
 */

import { useRef, useEffect } from "react"
import { useMemoizedFn } from "ahooks"
import {
	IframeUserInfoService,
	type IframeUserInfoConfig,
	type UserInfoAuthorizationRequest,
} from "../services/IframeUserInfoService"
import type { HTMLAppConfig, UserInfo } from "../types"

export interface UseIframeUserInfoOptions {
	/** iframe ref，用于构造 postToIframe */
	iframeRef: React.RefObject<HTMLIFrameElement>
	/** 获取当前用户信息的函数 */
	getUserInfo: () => UserInfo | null
	/** app.json permissions declaration. */
	appConfig?: HTMLAppConfig | null
	/** 请求敏感用户信息前的宿主侧授权确认。 */
	authorizeUserInfo?: (request: UserInfoAuthorizationRequest) => Promise<boolean>
}

export interface UseIframeUserInfoReturn {
	/** 分发 MAGIC_GET_USER_INFO_* 消息，返回 true 表示已处理 */
	handleUserInfoMessage: (type: string, payload: unknown) => Promise<boolean>
}

export function useIframeUserInfo(options: UseIframeUserInfoOptions): UseIframeUserInfoReturn {
	const { iframeRef, getUserInfo, appConfig, authorizeUserInfo } = options

	const serviceRef = useRef<IframeUserInfoService | null>(null)

	const postToIframe = useMemoizedFn((message: object) => {
		iframeRef.current?.contentWindow?.postMessage(message, "*")
	})

	useEffect(() => {
		const cfg: IframeUserInfoConfig = {
			postToIframe,
			getUserInfo,
			appConfig,
			authorizeUserInfo,
		}

		serviceRef.current = new IframeUserInfoService(cfg)

		return () => {
			serviceRef.current?.destroy()
			serviceRef.current = null
		}
	}, [postToIframe, getUserInfo, appConfig, authorizeUserInfo])

	const handleUserInfoMessage = useMemoizedFn(
		async (type: string, payload: unknown): Promise<boolean> => {
			if (!serviceRef.current) return false
			return serviceRef.current.handleMessage(type, payload)
		},
	)

	return { handleUserInfoMessage }
}

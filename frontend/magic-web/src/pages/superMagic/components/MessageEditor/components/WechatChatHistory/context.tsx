import { createContext, useContext } from "react"
import type { WechatChatActions } from "../../extensions/wechat-chat-history/types"

export const WechatChatContext = createContext<WechatChatActions | null>(null)
export const useWechatChatActions = () => useContext(WechatChatContext)

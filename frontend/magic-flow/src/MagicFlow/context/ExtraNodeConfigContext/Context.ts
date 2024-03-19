import { BaseNodeType } from "@/MagicFlow/register/node"
import React from "react"

export type ExtraNodeConfigCtx = React.PropsWithChildren<{
	// 公共样式，覆盖节点最外层的公共样式
	commonStyle?: React.CSSProperties
	// 可基于此自定义具体节点的其他样式
	nodeStyleMap?: Record<BaseNodeType, React.CSSProperties>
    // 自定义节点渲染配置
    customNodeRenderConfig?: Record<BaseNodeType, {
        // 是否隐藏描述
        hiddenDesc?: boolean
    }>
}>  

export const ExtraNodeConfigContext = React.createContext({
	commonStyle: {},
	nodeStyleMap: {}
} as ExtraNodeConfigCtx)

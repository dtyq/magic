/**
 * 业务组件传入相关的自定义props
 */
import React from "react"
import { MagicFlow } from "@/MagicFlow/types/flow"

// 将大Context拆分为多个小Context
// 1. UI部分Context - 最频繁变化的部分
export type ExternalUICtx = {
    header?: {
        buttons?: React.ReactElement
        backIcon?: React.ReactElement
        showImage?: boolean
        editEvent?: () => void
        defaultImage?: string
        customTags?: React.ReactElement
    }
    materialHeader?: React.ReactElement
    nodeToolbar?: {
        list: Array<{
            icon: () => React.ReactElement
            tooltip?: string
        }>
        mode?: "append" | "replaceAll"
    }
}

// 2. 配置Context - 不常变化的部分
export type ExternalConfigCtx = {
    paramsName?: MagicFlow.ParamsName
    onlyRenderVisibleElements?: boolean
    layoutOnMount?: boolean
    allowDebug?: boolean
    showExtraFlowInfo?: boolean
    omitNodeKeys?: string[]
}

// 3. 引用/回调Context - 引用类型，很少变化
export type ExternalRefCtx = {
    flowInteractionRef?: React.MutableRefObject<any>
}

// 向后兼容的完整Context
export type ExternalCtx = React.PropsWithChildren<
    ExternalUICtx & ExternalConfigCtx & ExternalRefCtx
>

// 创建各个独立Context
export const ExternalUIContext = React.createContext<ExternalUICtx>({
    header: undefined,
    materialHeader: undefined,
    nodeToolbar: undefined,
})

export const ExternalConfigContext = React.createContext<ExternalConfigCtx>({
    paramsName: undefined,
    onlyRenderVisibleElements: false,
    layoutOnMount: false,
    allowDebug: false,
    showExtraFlowInfo: false,
    omitNodeKeys: [],
})

export const ExternalRefContext = React.createContext<ExternalRefCtx>({
    flowInteractionRef: undefined,
})

// 保留原始Context以保持向后兼容性
export const ExternalContext = React.createContext<ExternalCtx>({
    header: {},
    nodeToolbar: { list: [] },
    materialHeader: undefined,
    paramsName: undefined,
    onlyRenderVisibleElements: false,
    layoutOnMount: false,
    allowDebug: false,
    showExtraFlowInfo: false,
    flowInteractionRef: undefined,
    omitNodeKeys: [],
})

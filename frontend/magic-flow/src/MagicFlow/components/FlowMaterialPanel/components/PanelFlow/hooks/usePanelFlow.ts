/**
 * 流程tab的数据
 */

import { nodeManager } from "@/MagicFlow/register/node"
import { getNodeSchema } from "@/MagicFlow/utils"
import { useMemo } from "react"
import { TabObject } from "../../../constants"
import { useStore } from "zustand"
import { flowStore } from "@/MagicFlow/store"

export default function usePanelFlow() {
    
    const { nodeVersionSchema } = useStore(flowStore, state => state)

    const schema = useMemo(() => {
        const flowNodeType = nodeManager?.materialNodeTypeMap?.[TabObject.Flow]
        if(!flowNodeType) return null
        return getNodeSchema(flowNodeType)
    }, [nodeVersionSchema])

    return {
        schema
    }
}

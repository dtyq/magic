import { FLOW_EVENTS, flowEventBus } from "@/common/BaseUI/Select/constants"
import { useEffect, useState } from "react"

export default function useEdgeSelected(id: string) {
    const [isSelected, setIsSelected] = useState(false)
    
    useEffect(() => {
        const cleanup = flowEventBus.on(FLOW_EVENTS.EDGE_SELECTED, (e: CustomEvent) => {
            const newIsSelected = e.detail === id
            if (newIsSelected !== isSelected) {
                setIsSelected(newIsSelected)
            }
        })
        return () => {
            cleanup()
        }
    }, [isSelected])

    

    return {
        isSelected
    }
}

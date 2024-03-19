import React, { memo } from "react"
import { MiniMap } from "reactflow"
import clsx from "clsx"
import { prefix } from "@/MagicFlow/constants"
import styles from "../../index.module.less"

interface FlowMiniMapProps {
  showMinMap: boolean
}

const FlowMiniMap = memo(({ showMinMap }: FlowMiniMapProps) => {
  if (!showMinMap) return null;
  
  return (
    <MiniMap
      nodeStrokeWidth={3}
      pannable
      position="bottom-right"
      className={clsx(styles.minMap, `${prefix}min-map`)}
      maskColor="rgba(0,0,0,0.2)"
    />
  )
})

export default FlowMiniMap 
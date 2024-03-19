import React, { memo } from "react"
import { Panel } from "reactflow"
import clsx from "clsx"
import { prefix } from "@/MagicFlow/constants"
import styles from "../../index.module.less"
import SelectionTools from "../SelectionTools"

interface FlowSelectionPanelProps {
  showSelectionTools: boolean
  setShowSelectionTools: (show: boolean) => void
  selectionNodes: any[]
  selectionEdges: any[]
  onCopy: () => void
}

const FlowSelectionPanel = memo(({
  showSelectionTools,
  setShowSelectionTools,
  selectionNodes,
  selectionEdges,
  onCopy
}: FlowSelectionPanelProps) => {
  return (
    <Panel
      position="top-center"
      className={clsx(styles.selectionPanel, `${prefix}selection-panel`)}
    >
      <SelectionTools
        show={showSelectionTools}
        setShow={setShowSelectionTools}
        selectionNodes={selectionNodes}
        selectionEdges={selectionEdges}
        onCopy={onCopy}
      />
    </Panel>
  )
})

export default FlowSelectionPanel 
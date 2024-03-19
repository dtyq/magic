import clsx from "clsx"
import React, { memo } from "react"
import { prefix } from "@/MagicFlow/constants"
import styles from "../../index.module.less"
import TextEditable from "../../components/TextEditable"
import Tags from "../../components/Tags"

interface FlowBaseInfoProps {
  flow: any
  updateFlow: (flow: any) => void
  tagList: any[]
  showExtraFlowInfo: boolean
  customTags: React.ReactNode
}

const FlowBaseInfo = memo(({
  flow,
  updateFlow,
  tagList,
  showExtraFlowInfo,
  customTags
}: FlowBaseInfoProps) => {
  return (
    <div className={clsx(styles.flowBaseInfo, `${prefix}flow-base-info`)}>
      <TextEditable
        title={flow?.name || ""}
        onChange={(value: string) => updateFlow({ ...flow, name: value })}
      />
      {showExtraFlowInfo && <Tags list={tagList} />}
      {customTags}
    </div>
  )
})

export default FlowBaseInfo 
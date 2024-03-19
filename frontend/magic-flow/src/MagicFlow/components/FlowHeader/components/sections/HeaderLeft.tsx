import clsx from "clsx"
import React, { memo } from "react"
import { prefix } from "@/MagicFlow/constants"
import styles from "../../index.module.less"
import FlowBaseInfo from "./FlowBaseInfo"
import BackButton from "./BackButton"
import FlowIcon from "./FlowIcon"

interface HeaderLeftProps {
  flow: any
  updateFlow: (flow: any) => void
  tagList: any[]
  header: any
  showExtraFlowInfo: boolean
  showImage: boolean
}

const HeaderLeft = memo(({
  flow,
  updateFlow,
  tagList,
  header,
  showExtraFlowInfo,
  showImage
}: HeaderLeftProps) => {
  return (
    <div className={clsx(styles.left, `${prefix}left`)}>
      <BackButton backIcon={header?.backIcon} />
      <FlowIcon 
        showImage={showImage} 
        icon={flow?.icon} 
        defaultImage={header?.defaultImage} 
      />
      <FlowBaseInfo
        flow={flow}
        updateFlow={updateFlow}
        tagList={tagList}
        showExtraFlowInfo={showExtraFlowInfo}
        customTags={header?.customTags}
      />
    </div>
  )
})

export default HeaderLeft 
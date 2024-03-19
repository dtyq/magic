import { prefix } from "@/MagicFlow/constants"
import { useExternal } from "@/MagicFlow/context/ExternalContext/useExternal"
import clsx from "clsx"
import _ from "lodash"
import React, { useMemo } from "react"
import { useFlowData } from "../../context/FlowContext/useFlow"
import useFlowHeader from "./hooks/useFlowHeader"
import styles from "./index.module.less"
import HeaderLeft from "./components/sections/HeaderLeft"
import HeaderRight from "./components/sections/HeaderRight"

export default function FlowHeader() {
	const { tagList, isSaveBtnLoading, isPublishBtnLoading } = useFlowHeader()
	const { header, showExtraFlowInfo } = useExternal()
	const { flow, updateFlow } = useFlowData()

	// 计算showImage，避免在子组件中计算
	const showImage = useMemo(() => {
		if (_.isBoolean(header?.showImage)) {
			return header?.showImage
		}
		return true
	}, [header?.showImage])

	return (
		<div className={clsx(styles.flowHeader, `${prefix}flow-header`)}>
			<HeaderLeft
				flow={flow}
				updateFlow={updateFlow}
				tagList={tagList}
				header={header}
				showExtraFlowInfo={showExtraFlowInfo}
				showImage={showImage}
			/>
			<HeaderRight
				header={header}
				isSaveBtnLoading={isSaveBtnLoading}
				isPublishBtnLoading={isPublishBtnLoading}
			/>
		</div>
	)
}

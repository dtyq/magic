import { useFlow } from "@/MagicFlow/context/FlowContext/useFlow"
import { getNodeSchema, getNodeVersion, judgeIsVariableNode } from "@/MagicFlow/utils"
import { getFormTypeToTitle } from "@/MagicJsonSchemaEditor/constants"
import { getCurrentTypeFromString } from "@/common/BaseUI/DropdownRenderer/Reference/components/Transformer/helpers"
import { useNodeMap } from "@/common/context/NodeMap/useResize"
import { IconClose } from "@douyinfe/semi-icons"
import { Tooltip } from "antd"
import { Icon } from "@iconify/react"
import { useMemoizedFn } from "ahooks"
import i18next from "i18next"
import _ from "lodash"
import React, { useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { SystemNodeSuffix } from "../../../constant"
import { useGlobalContext } from "../../../context/GlobalContext/useGlobalContext"
import { useTextareaModeContext } from "../../../context/TextareaMode/useTextareaModeContext"
import { LabelNodeStyle } from "../../../style"
import { EXPRESSION_ITEM } from "../../../types"
import useDatasetProps from "../../hooks/useDatasetProps"

interface LabelNodeProps {
	config: EXPRESSION_ITEM
	selected: boolean
	deleteFn: (val: EXPRESSION_ITEM) => void
	wrapperWidth: number
}

export function LabelNode({ config, selected, deleteFn, wrapperWidth }: LabelNodeProps) {
	const { t } = useTranslation()
	const { handleDoubleClickNode } = useTextareaModeContext()

	const { dataSourceMap, disabled } = useGlobalContext()

	const labelNodeRef = useRef<HTMLDivElement>(null)

	const { nodeMap } = useNodeMap()

	const { nodeConfig } = useFlow()

	const [beforeClassName, setBeforeClassName] = useState("")

	const currentValue = useMemo(() => {
		if (!config.value) return null
		return dataSourceMap[config.value]
	}, [dataSourceMap, config])

	const currentReferencedNode = useMemo(() => {
		if (currentValue) {
			return nodeConfig?.[currentValue?.nodeId]
		}
	}, [currentValue, nodeConfig])

	const { datasetProps } = useDatasetProps({ config })

	const formTypeLabel = useMemo(() => {
		if (!currentValue || !currentValue.type) return ""
		const formTypeToTitle = getFormTypeToTitle()
		let typeParams = currentValue.type
		if (config.trans) {
			const transType = getCurrentTypeFromString(config.trans)
			if (transType) {
				typeParams = transType
			}
		}
		return formTypeToTitle[typeParams]
	}, [currentValue])

	// console.log(dataSourceMap, currentValue)

	const currentNodeSchema = useMemo(() => {
		if (!currentValue) return null
		return getNodeSchema(currentValue.nodeType, getNodeVersion(currentReferencedNode!))
	}, [currentValue, nodeMap])

	/**
	 * 是否引用正常
	 * 正常情况是：当引用存在上文节点 & 引用的是常量
	 */
	const isReferenceSuccess = useMemo(() => {
		return !!((currentValue && currentNodeSchema) || currentValue?.isConstant)
	}, [currentValue, currentNodeSchema])

	const label = useMemo(() => {
		const nodeId = (currentValue?.nodeId as string)?.split?.(SystemNodeSuffix)[0]
		const node = _.get(nodeConfig, [nodeId || "empty"], null)

		const isVariableNode = judgeIsVariableNode(currentNodeSchema?.id as string)

		if (currentValue?.isConstant) {
			return i18next.t("common.constants", { ns: "magicFlow" })
		}
		if (isVariableNode) {
			return i18next.t("common.variables", { ns: "magicFlow" })
		}
		const result = node?.name || currentNodeSchema?.label

		return result
	}, [currentNodeSchema, nodeConfig])

	// console.log("nodeMap", nodeMap, currentNodeSchema, currentValue, config, dataSourceMap)

	// console.log("config", config)

	const ValueComp = useMemo(() => {
		return isReferenceSuccess ? (
			<>
				<div className="app-info" {...datasetProps}>
					<span className="app-icon" {...datasetProps}>
						{currentNodeSchema?.icon}
					</span>
					<span className="app-name" {...datasetProps}>
						{label}
					</span>
				</div>
				<span className="splitor" {...datasetProps}>
					/
				</span>
				<span className="field-label" {...datasetProps}>
					<Icon icon="tabler:variable" className="icon-variable" {...datasetProps} />

					<span className="title" {...datasetProps}>
						{currentValue?.title}
					</span>
				</span>
				<span className="field-type" {...datasetProps}>
					{formTypeLabel}
					{config.trans ? `(${i18next.t("common.trans", { ns: "magicFlow" })})` : ""}
				</span>
			</>
		) : (
			<span className="reference-error" {...datasetProps}>
				{i18next.t("common.dataHasBeenDelete", { ns: "magicFlow" })}
			</span>
		)
	}, [datasetProps, currentNodeSchema, currentValue, isReferenceSuccess])

	const onmouseenter = useMemoizedFn((e) => {
		e.preventDefault()
		e.stopPropagation()
		setBeforeClassName(e.target.className)
	})

	const transString = useMemo(() => {
		if (!config.trans) return currentValue?.title
		return `${currentValue?.title}.${config.trans}`
	}, [config, currentValue])

	const WrappedComponent = (
		<Tooltip
			title={`${label} | ${transString}`}
			className="expression-block"
			overlayStyle={{ maxWidth: 600 }}
		>
			<LabelNodeStyle
				contentEditable={false}
				id={config.uniqueId}
				onDoubleClick={() => handleDoubleClickNode(config)}
				selected={selected}
				disabled={disabled}
				wrapperWidth={wrapperWidth}
				isError={!isReferenceSuccess}
				{...datasetProps}
				ref={labelNodeRef}
				onMouseEnter={onmouseenter}
				className={beforeClassName}
			>
				{ValueComp}
				{!disabled && <IconClose onClick={() => deleteFn(config)} />}
			</LabelNodeStyle>
		</Tooltip>
	)

	return WrappedComponent
}

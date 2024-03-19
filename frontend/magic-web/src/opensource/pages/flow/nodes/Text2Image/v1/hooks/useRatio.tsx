import { useMemo } from "react"
import { Tooltip } from "antd"
import { IconHelp } from "@tabler/icons-react"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import type { InputExpressionValue } from "@dtyq/magic-flow/dist/MagicExpressionWidget/types"
import { LabelTypeMap } from "@dtyq/magic-flow/dist/MagicExpressionWidget/types"
import { useMemoizedFn } from "ahooks"
import type { Widget } from "@/opensource/types/flow"
import { useTranslation } from "react-i18next"
import { useFlowStore } from "@/opensource/stores/flow"
import { get } from "lodash-es"
import iconStyles from "../../../VectorSearch/v0/components/KnowledgeSelect/KnowledgeSelect.module.less"
import { ImageModel, mjRatioOptions, ratioToSize, voRatioOptions } from "../constants"

export default function useRatio() {
	const { t } = useTranslation()
	const { currentNode } = useCurrentNode()
	const { availableModels } = useFlowStore()

	const selectModelName = useMemo(() => {
		const selectedModel = availableModels.find(
			(model_id) => model_id.id === currentNode?.params?.model_id,
		)

		return selectedModel?.model_id?.toLowerCase?.()
	}, [currentNode?.params?.model_id, availableModels])

	const getSelectModel = useMemoizedFn((modelId: string) => {
		return availableModels.find((model_id) => model_id.id === modelId)
	})

	const ratioRenderConfig = useMemo(() => {
		return {
			type: LabelTypeMap.LabelNames,
			props: {
				value: null,
				onChange: () => {},
				options: selectModelName?.includes?.(ImageModel.Midjourney)
					? mjRatioOptions
					: voRatioOptions,
				suffix: (item: any) => {
					return (
						<Tooltip title={item.suffixText}>
							{item.suffixText && (
								<IconHelp
									className={iconStyles.iconWindowMaximize}
									size={20}
									stroke="rgba(28, 29, 35, 0.35)"
								/>
							)}
						</Tooltip>
					)
				},
			},
		}
	}, [selectModelName])

	const getRatioValue = useMemoizedFn((value: Widget<InputExpressionValue>) => {
		if (value?.structure?.type === "const") {
			const expressionVal = value.structure
			const constValue = expressionVal?.const_value || []
			if (constValue?.length > 1) return null
			const target = constValue.find((val) => val.type === LabelTypeMap.LabelNames)
			const namesValue = get(target, [`${LabelTypeMap.LabelNames}_value`], [])
			const ratioValue = namesValue?.[0]
			if (ratioValue) {
				const size = ratioToSize[ratioValue?.id]
				return size
			}
		}
		return null
	})

	const hasRatio = useMemo(() => {
		return (
			selectModelName?.includes?.(ImageModel.Midjourney) ||
			selectModelName?.includes?.(ImageModel.Volcengine)
		)
	}, [selectModelName])

	const hasSize = useMemo(() => {
		return (
			selectModelName?.includes?.(ImageModel.Volcengine) ||
			selectModelName?.includes?.("flux1")
		)
	}, [selectModelName])

	const hasSr = useMemo(() => {
		return selectModelName?.includes?.(ImageModel.Volcengine)
	}, [selectModelName])

	const tooltip = useMemo(() => {
		if (selectModelName?.includes?.(ImageModel.Midjourney)) {
			return t("text2Image.mjDesc", { ns: "flow" })
		}
		if (selectModelName?.includes?.(ImageModel.Volcengine)) {
			return t("text2Image.fluxDesc", { ns: "flow" })
		}
		return ""
	}, [selectModelName, t])

	return {
		ratioRenderConfig,
		getRatioValue,
		hasRatio,
		hasSize,
		hasSr,
		tooltip,
		getSelectModel,
	}
}

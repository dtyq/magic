import { useMemo } from "react"
import { Tooltip } from "antd"
import { IconHelp } from "@tabler/icons-react"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import type { InputExpressionValue } from "@dtyq/magic-flow/dist/MagicExpressionWidget/types"
import { LabelTypeMap } from "@dtyq/magic-flow/dist/MagicExpressionWidget/types"
import { useMemoizedFn } from "ahooks"
import type { Widget } from "@/types/flow"
import { get } from "lodash-es"
import { useTranslation } from "react-i18next"
import iconStyles from "../../../VectorSearch/v0/components/KnowledgeSelect/KnowledgeSelect.module.less"
import { ImageModel, mjRatioOptions, ratioToSize, voRatioOptions } from "../constants"

export default function useRatio() {
	const { t } = useTranslation()
	const { currentNode } = useCurrentNode()

	const ratioRenderConfig = useMemo(() => {
		return {
			type: LabelTypeMap.LabelNames,
			props: {
				value: null,
				onChange: () => { },
				options:
					currentNode?.params?.model === ImageModel.Midjourney
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
	}, [currentNode])

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
			currentNode?.params?.model?.includes?.(ImageModel.Midjourney) ||
			currentNode?.params?.model?.includes?.(ImageModel.Volcengine)
		)
	}, [currentNode?.params?.model])

	const hasSize = useMemo(() => {
		return (
			currentNode?.params?.model?.includes?.(ImageModel.Volcengine) ||
			currentNode?.params?.model?.includes?.("Flux")
		)
	}, [currentNode?.params?.model])

	const hasSr = useMemo(() => {
		return currentNode?.params?.model?.includes?.(ImageModel.Volcengine)
	}, [currentNode?.params?.model])

	const tooltip = useMemo(() => {
		const model = currentNode?.params?.model
		if (model?.includes?.(ImageModel.Midjourney)) {
			return t("text2Image.mjDesc", { ns: "flow" })
		}
		if (model?.includes?.("Flux1")) {
			return t("text2Image.fluxDesc", { ns: "flow" })
		}
		return ""
	}, [currentNode?.params?.model, t])

	return {
		ratioRenderConfig,
		getRatioValue,
		hasRatio,
		hasSize,
		hasSr,
		tooltip,
	}
}

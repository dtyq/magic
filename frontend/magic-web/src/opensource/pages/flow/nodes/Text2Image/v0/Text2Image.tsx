import { Form, Flex } from "antd"
import MagicSelect from "@dtyq/magic-flow/dist/common/BaseUI/Select"
import { useMemoizedFn } from "ahooks"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { useFlow } from "@dtyq/magic-flow/dist/MagicFlow/context/FlowContext/useFlow"
import { set } from "lodash-es"
import { ExpressionMode } from "@dtyq/magic-flow/dist/MagicExpressionWidget/constant"
import DropdownCard from "@dtyq/magic-flow/dist/common/BaseUI/DropdownCard"
import { cx } from "antd-style"
import { useMemo } from "react"
import { getExpressionPlaceholder, removeEmptyValues } from "@/opensource/pages/flow/utils/helpers"
import usePrevious from "@/opensource/pages/flow/common/hooks/usePrevious"
import useCurrentNodeUpdate from "@/opensource/pages/flow/common/hooks/useCurrentNodeUpdate"
import NodeOutputWrap from "@/opensource/pages/flow/components/NodeOutputWrap/NodeOutputWrap"
import MagicExpression from "@/opensource/pages/flow/common/Expression"
import { useTranslation } from "react-i18next"
import styles from "./Text2Image.module.less"
import { getDefaultSelfDefineRatio, getDefaultSize, ImageModelOptions } from "./constants"
import SRSwitch from "./components/SRSwitch/SRSwitch"
import useRatio from "./hooks/useRatio"
import { v0Template } from "./template"

export default function Text2ImageV0() {
	const { t } = useTranslation()
	const [form] = Form.useForm()

	const { currentNode } = useCurrentNode()

	const { updateNodeConfig } = useFlow()

	const { ratioRenderConfig, getRatioValue, hasRatio, hasSize, hasSr, tooltip } = useRatio()

	const setSize = useMemoizedFn(({ width, height }: { width: number; height: number }) => {
		if (!currentNode) return
		const newWidth = getDefaultSize(`${width}`)
		const newHeight = getDefaultSize(`${height}`)
		set(currentNode, ["params", "width"], newWidth)
		set(currentNode, ["params", "height"], newHeight)
		form.setFieldsValue({
			width: newWidth,
			height: newHeight,
		})
	})

	const onValuesChange = useMemoizedFn((changeValues) => {
		if (!currentNode) return

		Object.entries(changeValues).forEach(([changeKey, changeValue]) => {
			set(currentNode, ["params", changeKey], changeValue)
		})

		if (Reflect.has(changeValues, "width") || Reflect.has(changeValues, "height")) {
			const selfDefinedRatio = getDefaultSelfDefineRatio()
			set(currentNode, ["params", "ratio"], selfDefinedRatio)
			form.setFieldsValue({
				ratio: selfDefinedRatio,
			})
		}

		if (Reflect.has(changeValues, "ratio")) {
			const ratioValue = getRatioValue(changeValues.ratio)
			if (ratioValue) {
				setSize(ratioValue)
			}
		}

		if (Reflect.has(changeValues, "model")) {
			const newModel = changeValues.model
			if (newModel?.includes?.("Flux")) {
				setSize({
					width: 1024,
					height: 1024,
				})
			}
		}

		updateNodeConfig({
			...currentNode,
		})
	})

	const initialValues = useMemo(() => {
		return {
			...v0Template.params,
			...removeEmptyValues(currentNode?.params || {}),
		}
	}, [currentNode?.params])

	const { expressionDataSource } = usePrevious()

	useCurrentNodeUpdate({
		form,
		initialValues,
	})

	return (
		<NodeOutputWrap className={styles.text2Image}>
			<Form
				layout="vertical"
				form={form}
				onValuesChange={onValuesChange}
				initialValues={initialValues}
			>
				<Form.Item
					name="model"
					label={t("common.model", { ns: "flow" })}
					className={styles.formItem}
				>
					<MagicSelect options={ImageModelOptions} />
				</Form.Item>
				{hasRatio && (
					<MagicExpression
						name="ratio"
						label={t("text2Image.size", { ns: "flow" })}
						allowExpression
						dataSource={expressionDataSource}
						mode={ExpressionMode.Common}
						minHeight="auto"
						className={styles.formItem}
						multiple={false}
						// @ts-ignore
						renderConfig={ratioRenderConfig}
						onlyExpression={false}
					/>
				)}
				<MagicExpression
					name="reference_images"
					label={t("text2Image.referenceImage", { ns: "flow" })}
					dataSource={expressionDataSource}
					mode={ExpressionMode.Common}
					onlyExpression
					minHeight="auto"
					className={cx(styles.formItem)}
					placeholder={t("common.allowExpressionPlaceholder", { ns: "flow" })}
				/>
				{hasSize && (
					<Flex
						align="center"
						gap={6}
						justify="space-between"
						className={styles.formItem}
					>
						<MagicExpression
							name="width"
							label={t("common.width", { ns: "flow" })}
							onlyExpression
							dataSource={expressionDataSource}
							mode={ExpressionMode.Common}
							placeholder={t("common.allowExpressionPlaceholder", { ns: "flow" })}
							className={styles.heightCol}
							minHeight="auto"
						/>
						<MagicExpression
							name="height"
							label={t("common.height", { ns: "flow" })}
							onlyExpression
							dataSource={expressionDataSource}
							mode={ExpressionMode.Common}
							placeholder={t("common.allowExpressionPlaceholder", { ns: "flow" })}
							className={styles.widthCol}
							minHeight="auto"
						/>
					</Flex>
				)}
				{hasSr && (
					<Form.Item name="use_sr" className={styles.formItem}>
						<SRSwitch />
					</Form.Item>
				)}
				<div className={styles.midjourneyTooltip}>{tooltip}</div>
				<DropdownCard
					height="auto"
					title={t("text2Image.name", { ns: "flow" })}
					className={cx(styles.formItem, styles.imagePrompt)}
				>
					<MagicExpression
						label={t("text2Image.positivePrompt", { ns: "flow" })}
						name="user_prompt"
						placeholder={getExpressionPlaceholder(
							t("text2Image.positivePromptDesc", { ns: "flow" }),
						)}
						dataSource={expressionDataSource}
					/>

					{/* <MagicExpression
						label={t("text2Image.negativePrompt", { ns: "flow" })}
						name="negative_prompt"
						placeholder={getExpressionPlaceholder(
							t("text2Image.negativePromptDesc", { ns: "flow" }),
						)}
						dataSource={expressionDataSource}
					/> */}
				</DropdownCard>
			</Form>
		</NodeOutputWrap>
	)
}

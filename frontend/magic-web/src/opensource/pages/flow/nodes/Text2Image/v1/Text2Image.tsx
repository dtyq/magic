import { Form, Flex } from "antd"
import { useMemoizedFn } from "ahooks"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { useNodeConfigActions } from "@dtyq/magic-flow/dist/MagicFlow/context/FlowContext/useFlow"
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
import { useFlowStore } from "@/opensource/stores/flow"
import RenderLabelCommon from "@/opensource/pages/flow/components/RenderLabel/RenderLabel"
import { set } from "lodash-es"
import styles from "./Text2Image.module.less"
import { getDefaultSelfDefineRatio, getDefaultSize } from "./constants"
import SRSwitch from "./components/SRSwitch/SRSwitch"
import useRatio from "./hooks/useRatio"
import { v1Template } from "./template"
import EnhancedMagicSelect from "../../../components/MagicSelect"

export default function Text2ImageV1() {
	const { t } = useTranslation()
	const [form] = Form.useForm()
	const { availableModels } = useFlowStore()

	const { currentNode } = useCurrentNode()

	const { updateNodeConfig } = useNodeConfigActions()

	const { ratioRenderConfig, getRatioValue, hasRatio, hasSize, hasSr, tooltip, getSelectModel } =
		useRatio()

	// 将API返回的模型数据转换为Select组件需要的格式
	const dynamicModelOptions = useMemo(() => {
		if (!availableModels || availableModels.length === 0) {
			return []
		}

		// 直接生成选项列表（扁平结构）
		return availableModels.map((model) => ({
			label: (
				<Flex align="center" className={styles.optionLabel} gap={6}>
					<img src={model.icon} alt="" className={cx(styles.icon)} />
					<span>{model.name}</span>
				</Flex>
			),
			value: model.id,
			realLabel: model.name,
		}))
	}, [availableModels])

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

		if (Reflect.has(changeValues, "model_id")) {
			const newModel = changeValues.model_id
			// 使用数组方法替代for...of循环
			const selectedModel = getSelectModel(newModel)

			// 根据模型类型设置默认尺寸
			if (selectedModel && selectedModel?.name?.includes?.("flux")) {
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
			...v1Template.params,
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
					name="model_id"
					label={t("common.model", { ns: "flow" })}
					className={styles.formItem}
				>
					<EnhancedMagicSelect
						options={dynamicModelOptions}
						labelRender={(props: any) => {
							if (!props.value) return undefined
							if (!props.label) {
								return (
									<RenderLabelCommon
										name={t("common.invalidModel", { ns: "flow" })}
										danger
									/>
								)
							}

							return props.label
						}}
						dropdownRenderProps={{
							placeholder: t("common.searchModel", { ns: "flow" }),
						}}
					/>
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
					minHeight="auto"
					className={cx(styles.formItem)}
					onlyExpression
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

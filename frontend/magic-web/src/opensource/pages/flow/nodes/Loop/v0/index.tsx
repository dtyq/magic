import { useNodeConfigActions } from "@dtyq/magic-flow/dist/MagicFlow/context/FlowContext/useFlow"
import { InnerHandleType } from "@dtyq/magic-flow/dist/MagicFlow/nodes"
import CustomHandle from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/Handle/Source"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { useMemoizedFn } from "ahooks"
import { Form, Tooltip } from "antd"
import { IconInfoCircle } from "@tabler/icons-react"
import MagicExpressionWrap from "@dtyq/magic-flow/dist/common/BaseUI/MagicExpressionWrap"
import { ExpressionMode } from "@dtyq/magic-flow/dist/MagicExpressionWidget/constant"
import { set } from "lodash-es"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import styles from "./index.module.less"
import LoopTypeSelect, { LoopTypes } from "./components/LoopTypeSelect"
import usePrevious from "../../../common/hooks/usePrevious"
import MagicConditionWrap from "../../../common/ConditionWrap"
import useCurrentNodeUpdate from "../../../common/hooks/useCurrentNodeUpdate"

export default function LoopV0() {
	const { t } = useTranslation()
	const [form] = Form.useForm()
	const { currentNode } = useCurrentNode()
	const { updateNodeConfig } = useNodeConfigActions()

	const { expressionDataSource } = usePrevious()

	const onValuesChange = useMemoizedFn((changeValues) => {
		if (!currentNode) return
		Object.entries(changeValues).forEach(([key, value]) => {
			set(currentNode, ["params", key], value)
		})
		// notifyNodeChange?.()
		updateNodeConfig({ ...currentNode })
	})

	const initialValues = useMemo(() => {
		return {
			...currentNode?.params,
		}
	}, [currentNode])

	const currentLoopType = form.getFieldsValue().type

	useCurrentNodeUpdate({
		form,
		initialValues,
	})

	return (
		<div className={styles.loop}>
			<Form
				className={styles.loopCondition}
				form={form}
				onValuesChange={onValuesChange}
				layout="vertical"
				initialValues={initialValues}
			>
				<Form.Item name={["type"]}>
					<LoopTypeSelect />
				</Form.Item>
				{currentLoopType === LoopTypes.Condition && (
					<>
						<Form.Item
							name={["condition"]}
							extra={t("loop.conditionsDesc", { ns: "flow" })}
						>
							<MagicConditionWrap dataSource={expressionDataSource} />
						</Form.Item>
						<Form.Item
							name={["max_loop_count"]}
							label={t("loop.maxLoopCount", { ns: "flow" })}
						>
							<MagicExpressionWrap
								onlyExpression
								dataSource={expressionDataSource}
								mode={ExpressionMode.Common}
								placeholder={t("loop.maxLoopCountDesc", { ns: "flow" })}
							/>
						</Form.Item>
					</>
				)}
				{currentLoopType === LoopTypes.Count && (
					<Form.Item
						name={["count"]}
						label={t("loop.setCount", { ns: "flow" })}
						extra={t("loop.setCountDesc", { ns: "flow" })}
					>
						<MagicExpressionWrap
							dataSource={expressionDataSource}
							onlyExpression
							mode={ExpressionMode.Common}
						/>
					</Form.Item>
				)}
				{currentLoopType === LoopTypes.Array && (
					<Form.Item
						name={["array"]}
						label={t("loop.arrayLoop", { ns: "flow" })}
						extra={t("loop.arrayLoopDesc", { ns: "flow" })}
					>
						<MagicExpressionWrap
							dataSource={expressionDataSource}
							onlyExpression
							mode={ExpressionMode.Common}
						/>
					</Form.Item>
				)}
			</Form>
			<div className={styles.loopBody}>
				<span>{t("loop.loopBody", { ns: "flow" })}</span>
				<Tooltip title={t("loop.loopBodyDesc", { ns: "flow" })}>
					<IconInfoCircle stroke={1} width={16} height={16} />
				</Tooltip>
				<CustomHandle
					type="source"
					isConnectable
					nodeId={currentNode?.node_id || ""}
					isSelected
					id={InnerHandleType.LoopHandle}
				/>
			</div>
			<div className={styles.loopNext}>
				<span>{t("loop.loopNext", { ns: "flow" })}</span>
				<CustomHandle
					type="source"
					isConnectable
					nodeId={currentNode?.node_id || ""}
					isSelected
					id={InnerHandleType.LoopNext}
				/>
			</div>
		</div>
	)
}

import { Flex, Form, Tooltip } from "antd"
import { useForm } from "antd/lib/form/Form"
import { ExpressionMode } from "@dtyq/magic-flow/dist/MagicExpressionWidget/constant"
import { useMemo } from "react"
import { useMemoizedFn } from "ahooks"
import { useFlow } from "@dtyq/magic-flow/dist/MagicFlow/context/FlowContext/useFlow"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { set, cloneDeep } from "lodash-es"
import { IconHelp } from "@tabler/icons-react"
import MagicSelect from "@dtyq/magic-flow/dist/common/BaseUI/Select"
import { useTranslation } from "react-i18next"
import { getExpressionPlaceholder } from "@/opensource/pages/flow/utils/helpers"
import MagicExpression from "../../../common/Expression"
import usePrevious from "../../../common/hooks/usePrevious"
import styles from "./index.module.less"
import Output from "../../../common/Output"
import useCurrentNodeUpdate from "../../../common/hooks/useCurrentNodeUpdate"
import { v0Template } from "./template"

export default function CacheGetterV0() {
	const { t } = useTranslation()
	const [form] = useForm()
	const { nodeConfig, updateNodeConfig } = useFlow()

	const { currentNode } = useCurrentNode()

	const { expressionDataSource } = usePrevious()

	const onValuesChange = useMemoizedFn((changeValues) => {
		if (!currentNode || !nodeConfig || !nodeConfig[currentNode?.node_id]) return
		const currentNodeConfig = nodeConfig[currentNode?.node_id]

		Object.entries(changeValues).forEach(([changeKey, changeValue]) => {
			set(currentNodeConfig, ["params", changeKey], changeValue)
		})

		updateNodeConfig({
			...currentNodeConfig,
		})
	})

	const initialValues = useMemo(() => {
		return {
			...cloneDeep(v0Template.params),
			...currentNode?.params,
		}
	}, [currentNode?.params])

	useCurrentNodeUpdate({
		form,
		initialValues,
	})

	return (
		<div className={styles.cacheWrapper}>
			<Form
				form={form}
				layout="vertical"
				initialValues={initialValues}
				onValuesChange={onValuesChange}
			>
				<Form.Item
					name="cache_scope"
					label={
						<Flex align="center" gap={4}>
							<span>{t("common.scope", { ns: "flow" })}</span>
							<Tooltip
								overlayStyle={{
									maxWidth: 400,
								}}
								title={
									<div>
										<div>{t("common.agentScopeDesc", { ns: "flow" })}</div>
										<br />
										<div>{t("common.userScopeDesc", { ns: "flow" })}</div>
										<br />
										<div>{t("common.topicScopeDesc", { ns: "flow" })}</div>
									</div>
								}
							>
								<IconHelp size={14} />
							</Tooltip>
						</Flex>
					}
				>
					<MagicSelect
						options={[
							{ label: t("common.currentAgent", { ns: "flow" }), value: "agent" },
							{ label: t("common.currentUser", { ns: "flow" }), value: "user" },
							{ label: t("common.currentTopic", { ns: "flow" }), value: "topic" },
						]}
					/>
				</Form.Item>
				<MagicExpression
					name="cache_key"
					label={t("common.key", { ns: "flow" })}
					mode={ExpressionMode.TextArea}
					placeholder={getExpressionPlaceholder(
						t("cacheGetter.keyPlaceholder", { ns: "flow" }),
					)}
					dataSource={expressionDataSource}
					minHeight="100%"
				/>

				{/* @ts-ignore  */}
				<Output value={currentNode?.output} wrapperClassName={styles.output} />
			</Form>
		</div>
	)
}

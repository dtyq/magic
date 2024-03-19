import { Form } from "antd"
import { useForm } from "antd/lib/form/Form"
import { ExpressionMode } from "@dtyq/magic-flow/dist/MagicExpressionWidget/constant"
import BaseDropdownRenderer from "@dtyq/magic-flow/dist/common/BaseUI/DropdownRenderer/Base"
import TsSelect from "@dtyq/magic-flow/dist/common/BaseUI/Select"
import { useMemo, useState } from "react"
import { useMemoizedFn, useMount } from "ahooks"
import { useNodeConfigActions } from "@dtyq/magic-flow/dist/MagicFlow/context/FlowContext/useFlow"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { set, cloneDeep, get } from "lodash-es"
import { useTranslation } from "react-i18next"
import { getExpressionPlaceholder } from "@/opensource/pages/flow/utils/helpers"
import MagicExpression from "../../../common/Expression"
import usePrevious from "../../../common/hooks/usePrevious"
import { getMessageTypeOptions, MessageType } from "./constants"
import styles from "./index.module.less"
import useCurrentNodeUpdate from "../../../common/hooks/useCurrentNodeUpdate"
import useReply from "./hooks/useMessageMemory"
import { v0Template } from "./template"

export default function MessageMemoryV0() {
	const { t } = useTranslation()
	const [form] = useForm()
	const { updateNodeConfig } = useNodeConfigActions()

	const { currentNode } = useCurrentNode()
	const [messageType, setMessageType] = useState(MessageType.Text)

	const messageTypeOptions = useMemo(() => {
		return getMessageTypeOptions(styles, t)
	}, [t])

	const { getLinkText } = useReply()

	const { expressionDataSource } = usePrevious()

	const onValuesChange = useMemoizedFn((changeValues) => {
		if (!currentNode) return

		Object.entries(changeValues).forEach(([changeKey, changeValue]) => {
			if (changeKey === "type") {
				setMessageType(changeValue as MessageType)
			}
			set(currentNode, ["params", changeKey], changeValue)
		})

		updateNodeConfig({
			...currentNode,
		})
	})

	const initialValues = useMemo(() => {
		const cloneTemplateParams = cloneDeep(v0Template.params)
		return {
			...cloneTemplateParams,
			...currentNode?.params,
			link: currentNode?.params?.link || cloneTemplateParams?.link,
			link_desc: currentNode?.params?.link_desc || cloneTemplateParams?.link_desc,
		}
	}, [currentNode?.params])

	useCurrentNodeUpdate({
		form,
		initialValues,
	})

	useMount(() => {
		const type = get(currentNode, ["params", "type"], MessageType.Text)
		setMessageType(type)
	})

	return (
		<div className={styles.replyWrapper}>
			<Form
				form={form}
				layout="vertical"
				initialValues={initialValues}
				onValuesChange={onValuesChange}
			>
				<Form.Item name="type" label={t("common.messageType", { ns: "flow" })}>
					<TsSelect
						options={messageTypeOptions}
						dropdownRenderProps={{
							placeholder: t("reply.searchMessageType", { ns: "flow" }),
							component: BaseDropdownRenderer,
						}}
						className={styles.messageTypeSelect}
						placeholder={t("common.pleaseSelect", { ns: "flow" })}
					/>
				</Form.Item>
				{messageType === MessageType.Text && (
					<MagicExpression
						name="content"
						label={t("common.messageContent", { ns: "flow" })}
						mode={ExpressionMode.TextArea}
						placeholder={getExpressionPlaceholder(
							t("reply.messageContentPlaceholder", { ns: "flow" }),
						)}
						dataSource={expressionDataSource}
					/>
				)}
				{(messageType === MessageType.Image || messageType === MessageType.File) && (
					<>
						<MagicExpression
							name="link"
							label={getLinkText(messageType).text.label}
							mode={ExpressionMode.TextArea}
							placeholder={getLinkText(messageType).text.placeholder}
							dataSource={expressionDataSource}
							minHeight="100%"
							className={styles.link}
						/>
						<MagicExpression
							name="link_desc"
							label={getLinkText(messageType).desc.label}
							mode={ExpressionMode.TextArea}
							placeholder={getLinkText(messageType).desc.placeholder}
							dataSource={expressionDataSource}
							minHeight="100%"
						/>
					</>
				)}
			</Form>
		</div>
	)
}

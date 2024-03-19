import { ExpressionMode } from "@/MagicExpressionWidget/constant"
import { useFlow } from "@/MagicFlow/context/FlowContext/useFlow"
import { useCurrentNode } from "@/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import BaseDropdownRenderer from "@/common/BaseUI/DropdownRenderer/Base"
import TsSelect from "@/common/BaseUI/Select"
import { Form } from "antd"
import { DefaultOptionType } from "antd/lib/select"
import { IconPhoto, IconTextSize } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import _ from "lodash"
import React, { ReactNode, useMemo } from "react"
import MagicExpression from "../../common/Expression"
import usePrevious from "../../common/hooks/usePrevious"
import { MessageType } from "./constants"
import useReply from "./hooks/useReply"
import styles from "./index.module.less"

type OptionType = DefaultOptionType & { icon: ReactNode }

export default function Reply() {
	const { updateNodeConfig, nodeConfig } = useFlow()

	const { currentNode } = useCurrentNode()

	const [form] = Form.useForm()
	const messageTypeOptions = useMemo(() => {
		return [
			{
				label: (
					<div className={styles.label}>
						<IconTextSize color="#000000" stroke={1} className={styles.icon} />
						<span>文本</span>
					</div>
				),
				realLabel: "文本",
				value: MessageType.Text,
			},
			{
				label: (
					<div className={styles.label}>
						<IconPhoto color="#3A57D1" stroke={1} className={styles.icon} />
						<span>图片</span>
					</div>
				),
				realLabel: "图片",
				value: MessageType.Image,
			},
		]
	}, [])

	const formValues = form.getFieldsValue()

	const { replyTemplate } = useReply()

	const { expressionDataSource } = usePrevious()

	const onValuesChange = useMemoizedFn((changeValues) => {
		if (!currentNode || !nodeConfig || !nodeConfig[currentNode?.node_id]) return
		const currentNodeConfig = nodeConfig[currentNode?.node_id]

		Object.entries(changeValues).forEach(([changeKey, changeValue]) => {
			_.set(currentNodeConfig, ["params", changeKey], changeValue)
		})

		updateNodeConfig({
			...currentNodeConfig,
		})
	})

	const initialValues = useMemo(() => {
		return currentNode?.params
	}, [currentNode?.params])

	return (
		<div className={styles.replyWrapper}>
			<Form
				form={form}
				layout="vertical"
				onValuesChange={onValuesChange}
				initialValues={initialValues}
			>
				<Form.Item name="type" label="消息卡片类型">
					<TsSelect
						options={messageTypeOptions}
						dropdownRenderProps={{
							placeholder: "搜索卡片类型",
							component: BaseDropdownRenderer,
						}}
						className={styles.messageTypeSelect}
						placeholder="请选择"
					/>
				</Form.Item>
				{formValues.type === MessageType.Text && (
					<MagicExpression
						name="content"
						label="消息内容"
						mode={ExpressionMode.TextArea}
						placeholder="纯文本的消息内容，支持使用“$+空格”添加变量"
						dataSource={expressionDataSource}
					/>
				)}
				{formValues.type === MessageType.Image && (
					<>
						<MagicExpression
							name="link"
							label="图片链接"
							mode={ExpressionMode.TextArea}
							placeholder="输入图片链接，支持使用“$+空格”添加变量"
							minHeight="100%"
							dataSource={expressionDataSource}
						/>
						<MagicExpression
							name="link_desc"
							label="描述文本"
							mode={ExpressionMode.TextArea}
							placeholder="输入描述文本，支持使用“$+空格”添加变量"
							minHeight="100%"
							dataSource={expressionDataSource}
						/>
					</>
				)}
			</Form>
		</div>
	)
}

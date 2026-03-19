import { IconClockStop, IconHandClick } from "@tabler/icons-react"
import { cx } from "antd-style"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { Flex, Form, Switch } from "antd"
import MagicSelect from "@dtyq/magic-flow/dist/common/BaseUI/Select"
import MagicInput from "@dtyq/magic-flow/dist/common/BaseUI/Input"
import { useMemo } from "react"
import { cloneDeep, set } from "lodash-es"
import { useMemoizedFn } from "ahooks"
import { useFlow } from "@dtyq/magic-flow/dist/MagicFlow/context/FlowContext/useFlow"
import { useTranslation } from "react-i18next"
import Common from "../../Start/v0/components/Common"
import styles from "./WaitForReply.module.less"
import useCurrentNodeUpdate from "../../../common/hooks/useCurrentNodeUpdate"
import { v0Template } from "./template"

export default function WaitForReplyV0() {
	const { t } = useTranslation()
	const [form] = Form.useForm()
	const { currentNode } = useCurrentNode()

	const { updateNodeConfig } = useFlow()

	const initialValues = useMemo(() => {
		return {
			...cloneDeep(v0Template.params),
			...currentNode?.params,
		}
	}, [currentNode?.params])

	const onValuesChange = useMemoizedFn((changeValues) => {
		if (!currentNode) return

		Object.entries(changeValues).forEach(([changeKey, changeValue]) => {
			if (changeKey === "timeout_config") {
				Object.entries(changeValue || {}).forEach(([timeoutKey, timeoutValue]) => {
					set(currentNode, ["params", "timeout_config", timeoutKey], timeoutValue)
				})
				return
			}
			set(currentNode, ["params", changeKey], changeValue)
		})

		updateNodeConfig({
			...currentNode,
		})
	})

	useCurrentNodeUpdate({
		form,
		initialValues,
	})

	return (
		<Form
			className={styles.waitForReplay}
			initialValues={initialValues}
			onValuesChange={onValuesChange}
			form={form}
		>
			<Common
				icon={
					<IconHandClick
						color="#315CEC"
						className={cx(styles.icon, styles.messageIcon)}
					/>
				}
				title={t("waitForReply.whenReply", { ns: "flow" })}
				template={currentNode?.output?.form}
				className="start-list-item"
			/>
			<Common
				icon={
					<IconClockStop
						color="#FF7D00"
						className={cx(styles.icon, styles.messageIcon)}
					/>
				}
				title={
					<Flex align="center" gap={6} className={styles.extraTitleWrap}>
						<span>{t("waitForReply.timeout", { ns: "flow" })}</span>
						<Form.Item name={["timeout_config", "enabled"]} valuePropName="checked">
							<Switch size="small" />
						</Form.Item>
					</Flex>
				}
				className={cx("start-list-item")}
				showHandle={false}
			>
				{currentNode?.params?.timeout_config?.enabled && (
					<Flex gap={6} align="center">
						<Form.Item
							name={["timeout_config", "interval"]}
							style={{ flex: 1 }}
							normalize={(value) => Number(value)}
						>
							<MagicInput
								placeholder={t("common.time", { ns: "flow" })}
								type="number"
								className="nodrag"
							/>
						</Form.Item>
						<Form.Item name={["timeout_config", "unit"]} style={{ width: "100px" }}>
							<MagicSelect
								options={[
									{ label: t("common.hours", { ns: "flow" }), value: "hours" },
									{
										label: t("common.minutes", { ns: "flow" }),
										value: "minutes",
									},
									{
										label: t("common.seconds", { ns: "flow" }),
										value: "seconds",
									},
								]}
								className={styles.select}
							/>
						</Form.Item>
					</Flex>
				)}
			</Common>
			<div className={styles.tips}>{t("waitForReply.timeoutDesc", { ns: "flow" })}</div>
		</Form>
	)
}

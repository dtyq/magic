import { useTranslation } from "react-i18next"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import { Form, Input, Button } from "antd"
import { useMemoizedFn } from "ahooks"
import { useForm } from "antd/es/form/Form"
import MagicModal from "@/opensource/components/base/MagicModal"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import { FlowType } from "@/opensource/types/flow"
import { useEffect, useMemo } from "react"
import { createStyles } from "antd-style"
import { botStore } from "@/opensource/stores/bot"
import { FlowApi } from "@/opensource/apis"
import { useModalFooterStyles } from "../shared/styles"
import { openFlowModal, preloadFlowModal } from "../FlowModal/openFlowModal"

type CreateToolForm = Pick<MagicFlow.Flow, "name" | "description"> & {
	icon: string
}

type CreateToolModalProps = {
	open: boolean
	toolsetId: string
	onClose: () => void
	onSuccess?: (data: MagicFlow.Flow) => void
	/** 是否显示"仅添加"按钮，默认为true */
	showJustAddButton?: boolean
	/** 是否显示"添加并下一步"按钮，默认为true */
	showAddAndNextButton?: boolean
	/** 当流程发布完成时的回调 */
	onFlowPublished?: () => void
}

const useStyles = createStyles(({ css, token }) => {
	return {
		avatar: css`
			padding-top: 20px;
			padding-bottom: 20px;
			border-radius: 12px;
			border: 1px solid ${token.magicColorUsages.border};
		`,
		formItem: css`
			margin-bottom: 10px;
			&:last-child {
				margin-bottom: 0;
			}
		`,
	}
})

function CreateToolModal({
	open,
	toolsetId,
	onClose,
	onSuccess,
	showJustAddButton = true,
	showAddAndNextButton = true,
	onFlowPublished,
}: CreateToolModalProps) {
	const { t } = useTranslation()

	const { styles } = useStyles()
	const { styles: footerStyles } = useModalFooterStyles()
	const [form] = useForm<CreateToolForm>()

	const defaultAvatar = botStore.defaultIcon.icons

	const handleCancel = useMemoizedFn(() => {
		form.resetFields()
		onClose()
	})

	// 仅添加工具
	const handleJustAdd = useMemoizedFn(async () => {
		try {
			const res = await form.validateFields()

			try {
				const data = await FlowApi.addOrUpdateFlowBaseInfo({
					name: res.name.trim(),
					description: res.description,
					icon: res.icon || defaultAvatar.flow,
					type: Number(FlowType.Tools) as never,
					tool_set_id: toolsetId,
				})

				// 仅添加按钮：调用onSuccess通知外部组件，但不触发Flow编辑
				onSuccess?.(data)
				handleCancel()
				magicToast.success(t("common.createSuccess", { ns: "flow" }))
			} catch (err: unknown) {
				if (err instanceof Error && err.message) {
					magicToast.error(err.message)
				}
			}
		} catch (err_1) {
			console.error("form validate error: ", err_1)
		}
	})

	// 添加并下一步
	const handleAddAndNext = useMemoizedFn(async () => {
		try {
			const res = await form.validateFields()

			try {
				const data = await FlowApi.addOrUpdateFlowBaseInfo({
					name: res.name.trim(),
					description: res.description,
					icon: res.icon || defaultAvatar.flow,
					type: Number(FlowType.Tools) as never,
					tool_set_id: toolsetId,
				})

				// 显示工具创建成功消息
				magicToast.success(t("common.createSuccess", { ns: "flow" }))

				if (!data.id) return

				// 立即关闭工具创建弹窗，避免影响其他弹窗
				handleCancel()

				// 打开FlowModal
				openFlowModal({
					id: data.id,
					onFlowPublished: () => {
						// Flow发布完成后才触发工具添加到MCP的回调
						onSuccess?.(data)
						// Flow发布完成后的回调
						onFlowPublished?.()
					},
				})
			} catch (err: unknown) {
				if (err instanceof Error && err.message) {
					magicToast.error(err.message)
				}
			}
		} catch (err_1) {
			console.error("form validate error: ", err_1)
		}
	})

	// 生成自定义footer
	const customFooter = useMemo(() => {
		const buttons = []

		// 取消按钮
		buttons.push(
			<Button key="cancel" onClick={handleCancel} className={footerStyles.cancelButton}>
				{t("common.tool.form.cancel", { ns: "agent" })}
			</Button>,
		)

		// 仅添加按钮（可选）
		if (showJustAddButton) {
			buttons.push(
				<Button
					key="justAdd"
					onClick={handleJustAdd}
					className={footerStyles.secondaryButton}
				>
					{t("common.tool.form.justAdd", { ns: "agent" })}
				</Button>,
			)
		}

		// 添加并下一步按钮（可选）
		if (showAddAndNextButton) {
			buttons.push(
				<Button
					key="addAndNext"
					onClick={handleAddAndNext}
					onMouseEnter={preloadFlowModal}
					className={footerStyles.primaryButton}
				>
					{t("common.tool.form.addAndNext", { ns: "agent" })}
				</Button>,
			)
		}

		return <div className={footerStyles.footerContainer}>{buttons}</div>
	}, [
		handleCancel,
		handleJustAdd,
		handleAddAndNext,
		footerStyles,
		t,
		showJustAddButton,
		showAddAndNextButton,
	])

	useEffect(() => {
		if (!open) {
			form.resetFields()
		}
	}, [open, form])

	return (
		<>
			<MagicModal
				title={t("common.createSomething", {
					ns: "flow",
					name: t("tools.name", { ns: "flow" }),
				})}
				open={open}
				onCancel={handleCancel}
				afterClose={() => form.resetFields()}
				closable
				maskClosable={false}
				centered
				footer={customFooter}
			>
				<Form
					form={form}
					validateMessages={{ required: t("form.required", { ns: "interface" }) }}
					layout="vertical"
					preserve={false}
				>
					<Form.Item
						name="name"
						label={t("common.inputName", {
							ns: "flow",
							name: t("tools.name", { ns: "flow" }),
						})}
						required
						rules={[{ required: true }]}
						className={styles.formItem}
					>
						<Input
							placeholder={t("common.inputNamePlaceholder", {
								ns: "flow",
								name: t("tools.name", { ns: "flow" }),
							})}
						/>
					</Form.Item>
					<Form.Item
						name="description"
						label={t("common.inputDesc", {
							ns: "flow",
							name: t("tools.name", { ns: "flow" }),
						})}
						className={styles.formItem}
						required
					>
						<Input.TextArea
							style={{
								minHeight: "138px",
							}}
							placeholder={t("common.inputDescPlaceholder", {
								ns: "flow",
								name: t("tools.name", { ns: "flow" }),
							})}
						/>
					</Form.Item>
				</Form>
			</MagicModal>
		</>
	)
}

export default CreateToolModal

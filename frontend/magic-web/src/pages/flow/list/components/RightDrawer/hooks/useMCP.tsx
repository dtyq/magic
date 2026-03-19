import { FlowApi } from "@/apis"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import { Dispatch, SetStateAction, useEffect, useMemo, useState, useRef } from "react"
import { DataType, DrawerItem } from ".."
import { Flow } from "@/types/flow"
import { Form, Input } from "antd"
import { useTranslation } from "react-i18next"
import MagicModal from "@/components/base/MagicModal"
import magicToast from "@/components/base/MagicToaster/utils"

type UseMCPProps = {
	setDrawerItems: Dispatch<SetStateAction<DrawerItem[]>>
	mutate: (data: any) => void
	open: boolean
	data: DataType
	setCurrentFlow: (flow: DataType) => void
}

type ModifyMCPUrlForm = {
	external_sse_url: string
}

export default function useMCP({
	setDrawerItems,
	mutate,
	open,
	data,
	setCurrentFlow,
}: UseMCPProps) {
	const { t } = useTranslation("flow")
	const [form] = Form.useForm<ModifyMCPUrlForm>()
	const [modalOpen, setModalOpen] = useState(false)
	const [currentMcp, setCurrentMcp] = useState<Flow.Mcp.Detail | null>(null)
	const [saving, setSaving] = useState(false)
	const [mcpStatus, setMcpStatus] = useState<"idle" | "success" | "error">("idle")
	const [mcpToolLength, setMcpToolLength] = useState(0)
	const currentRequestRef = useRef<string>("")

	const updateMCPDrawerItems = useMemoizedFn(async (id: string) => {
		const mcpTools = await FlowApi.getMcpToolList(id as string)
		if (mcpTools.list.length) {
			const items = mcpTools.list.map((tool) => {
				return {
					id: tool.id,
					title: tool.name,
					desc: tool.description,
					enabled: tool.enabled,
					more: true,
					rawData: tool,
				}
			})
			// @ts-ignore
			setDrawerItems(items)
			mutate((currentData: any[]) => {
				return currentData?.map((page) => ({
					...page,
					list: page?.list.map((item: Flow.Mcp.Detail) => {
						if (item.id === id) {
							return {
								...item,
								tools_count: mcpTools.list.length,
							}
						}
						return item
					}),
				}))
			})
		}
	})

	useUpdateEffect(() => {
		if (data?.type !== "external_sse") {
			currentRequestRef.current = ""
		}
	}, [data])

	const checkMCPStatus = useMemoizedFn(async (id: string, requestId?: string) => {
		try {
			const response = await FlowApi.getMCPStatus(id)

			if (requestId && requestId !== currentRequestRef.current) {
				return
			}

			if (response.success === "success") {
				setMcpStatus("success")
				setDrawerItems(
					response.tools.map((tool) => {
						return {
							id: tool.id,
							title: tool.name,
							desc: tool.description,
							enabled: tool.enabled,
							more: false,
							rawData: tool,
						}
					}),
				)

				mutate((currentData: any[]) => {
					return currentData?.map((page) => ({
						...page,
						list: page?.list.map((item: Flow.Mcp.Detail) => {
							if (item.id === id) {
								return {
									...item,
									tools_count: response.tools.length,
								}
							}
							return item
						}),
					}))
				})
				setMcpToolLength(response.tools.length)
			} else {
				setMcpStatus("error")
			}
		} catch (error) {
			if (requestId && requestId !== currentRequestRef.current) {
				return
			}
			console.error("query mcp status error:", error)
			setMcpStatus("error")
		}
	})

	const handleSaveMCPUrl = useMemoizedFn(async () => {
		if (!currentMcp) return

		try {
			setSaving(true)
			const values = await form.validateFields()

			const params: Flow.Mcp.SaveParams = {
				id: currentMcp.id,
				name: currentMcp.name,
				description: currentMcp.description,
				icon: currentMcp.icon,
				type: currentMcp.type,
				external_sse_url: values.external_sse_url,
			}

			await FlowApi.saveMcp(params)

			magicToast.success(t("common.savedSuccess", { ns: "flow" }))

			setModalOpen(false)
			setCurrentMcp(null)
			setCurrentFlow({
				...data,
				external_sse_url: values.external_sse_url,
			})
			form.resetFields()

			const requestId = `${Date.now()}-${Math.random()}`
			currentRequestRef.current = requestId
			checkMCPStatus(data?.id as string, requestId)
		} catch (error) {
			console.error("save mcp url error:", error)
		} finally {
			setSaving(false)
		}
	})

	const handleCancelModal = useMemoizedFn(() => {
		setModalOpen(false)
		setCurrentMcp(null)
		form.resetFields()
	})

	const openModifyMCPUrl = useMemoizedFn(async (mcp: Flow.Mcp.Detail) => {
		console.log(mcp)
		setCurrentMcp(mcp)

		// Get current external_sse_url, may need to fetch detailed information first
		form.setFieldsValue({
			external_sse_url: mcp?.external_sse_url || "",
		})
		setModalOpen(true)
	})

	const MCPModal = useMemo(() => {
		return (
			<MagicModal
				title={t("common.modifyMCPUrl")}
				open={modalOpen}
				onOk={handleSaveMCPUrl}
				onCancel={handleCancelModal}
				confirmLoading={saving}
				okButtonProps={{
					disabled: saving,
				}}
			>
				<Form
					form={form}
					layout="vertical"
					preserve={false}
					validateTrigger={["onChange", "onBlur"]}
					initialValues={{
						external_sse_url: (data as Flow.Mcp.Detail)?.external_sse_url || "",
					}}
				>
					<Form.Item
						name="external_sse_url"
						label={t("common.mcpSSEUrl")}
						validateTrigger={["onChange", "onBlur"]}
						rules={[
							{ required: true, message: t("common.inputSSEUrlPlaceholder") },
							{ pattern: /^https?:\/\/.+/, message: t("common.invalidSSEUrl") },
						]}
					>
						<Input placeholder={t("common.inputSSEUrlPlaceholder")} disabled={saving} />
					</Form.Item>
				</Form>
			</MagicModal>
		)
	}, [modalOpen, saving, form, handleSaveMCPUrl, handleCancelModal, t])

	useEffect(() => {
		handleCancelModal()
		setMcpStatus("idle")

		if (open && data?.type === "external_sse") {
			// 生成新的请求标识符来处理竞态问题
			const requestId = `${Date.now()}-${Math.random()}`
			currentRequestRef.current = requestId

			checkMCPStatus(data?.id as string, requestId)
		}
	}, [open, data])

	useEffect(() => {
		if (data?.type === "external_sse") {
			form.setFieldsValue({
				external_sse_url: (data as Flow.Mcp.Detail)?.external_sse_url || "",
			})
		}
	}, [modalOpen, data])

	return {
		checkMCPStatus,
		updateMCPDrawerItems,
		openModifyMCPUrl,
		MCPModal,
		mcpStatus,
		mcpToolLength,
	}
}

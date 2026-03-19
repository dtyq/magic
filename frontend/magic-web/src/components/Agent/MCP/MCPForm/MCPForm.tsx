import { Form, Collapse, Select, Popconfirm } from "antd"
import magicToast from "@/components/base/MagicToaster/utils"
import {
	IconX,
	IconPackageImport,
	IconPlus,
	IconCircleMinus,
	IconChevronDown,
	IconCheck,
} from "@tabler/icons-react"
import MagicAvatar from "@/components/base/MagicAvatar"
import UploadButton from "../../../../pages/explore/components/UploadButton"
import { useEffect, useMemo, useRef, useState } from "react"
import { IconMCP } from "@/enhance/tabler/icons-react"
import { useUpload } from "@/hooks/useUploadFiles"
import type { FileData } from "@/pages/chatNew/components/MessageEditor/components/InputFiles/types"
import { useMemoizedFn, useMount, useRequest, useThrottleFn, useDebounceFn } from "ahooks"
import { genFileData } from "@/pages/chatNew/components/MessageEditor/components/InputFiles/utils"
import { useTranslation } from "react-i18next"
import MagicSpin from "@/components/base/MagicSpin"
import type { FormItemProps } from "antd"
import { FlowApi } from "@/apis"
import Editor from "react-simple-code-editor"
import { highlight, languages } from "prismjs/components/prism-core"
import "prismjs/components/prism-json"
import type { AgentCommonModalChildrenProps } from "../../AgentCommonModal"
import { MCPType } from "../types"
import { set } from "lodash-es"
import { MCPFormField, importHeaders, MCPConfigToJson } from "./helpers"
import ToolsPanel from "./ToolsPanel"
import type { ToolsPanelRefs } from "./ToolsPanel"
import { cn } from "@/lib/utils"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { Textarea } from "@/components/shadcn-ui/textarea"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Switch } from "@/components/shadcn-ui/switch"

interface MCPFormProps extends AgentCommonModalChildrenProps {
	/** Business layer ID, if exists it's for editing, if not it's for creating */
	id?: string
	/** Callback after successful handling */
	onSuccessCallback?: () => void
}

const SubFormProps: FormItemProps = {
	layout: "horizontal",
	required: true,
	labelAlign: "left",
	labelCol: {
		span: 10,
	},
	rules: [{ required: true }],
}

const defaultMCPFormValues = {}

const formItemClassName = cn(
	"mb-2.5 last:mb-0",
	"[&_.magic-form-item-label]:!pb-1.5",
	"[&_.magic-form-item-label_label]:text-xs",
	"[&_.magic-form-item-label_label]:font-normal",
	"[&_.magic-form-item-label_label]:leading-4",
	"[&_.magic-form-item-label_label]:text-muted-foreground",
)

const iconActionButtonClassName = cn(
	"inline-flex min-h-8 min-w-8 items-center justify-center gap-1 rounded-md bg-fill p-1.5",
	"cursor-pointer text-foreground transition-colors",
	"hover:bg-fill-secondary active:bg-black/[0.13] dark:active:bg-white/[0.13]",
	"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
)

const optionCardClassName = cn(
	"flex flex-1 items-start gap-1 rounded-md border border-border bg-background p-2.5 text-left",
	"cursor-pointer transition-all",
	"hover:bg-fill active:bg-fill-secondary",
	"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
)

const optionCardSelectedClassName =
	"border-primary shadow-[0_0_1px_rgba(0,0,0,0.3),0_4px_14px_rgba(0,0,0,0.1)]"

export default function MCPForm(props: MCPFormProps) {
	const { id, onClose, onSuccessCallback } = props

	const { t } = useTranslation("agent")
	const [form] = Form.useForm()
	const toolsPanelRefs = useRef<ToolsPanelRefs>({} as ToolsPanelRefs)

	const [imageUrl, setImageUrl] = useState<string>()
	const [jsonImportEnabled, setJsonImportEnabled] = useState(true)
	// JSON editor content state
	const [editorValue, setEditorValue] = useState("")
	const [jsonValidationStatus, setJsonValidationStatus] = useState<"valid" | "invalid" | null>(
		null,
	)
	// Tracks user typing to avoid sync loops
	const isUserEditingRef = useRef(false)

	// Initialize editor content
	useEffect(() => {
		if (jsonImportEnabled && !editorValue) {
			isUserEditingRef.current = false
			const initialValue = JSON.stringify(
				{
					mcpServers: {
						[form.getFieldValue(MCPFormField.Name) || ""]: MCPConfigToJson(
							form.getFieldsValue(),
						),
					},
				},
				null,
				4,
			)
			setEditorValue(initialValue)
		}
	}, [jsonImportEnabled, editorValue, form])

	// Clear editor when JSON import is off
	useEffect(() => {
		if (!jsonImportEnabled) {
			setEditorValue("")
			isUserEditingRef.current = false
		}
	}, [jsonImportEnabled])

	// Sync form values to editor
	const formName = Form.useWatch(MCPFormField.Name, form)
	const formType = Form.useWatch(MCPFormField.MCPType, form)
	const formServiceConfig = Form.useWatch(MCPFormField.ServiceConfig, form)

	useEffect(() => {
		// Sync only when not actively edited by user
		if (jsonImportEnabled && !isUserEditingRef.current) {
			const newValue = JSON.stringify(
				{
					mcpServers: {
						[formName || ""]: MCPConfigToJson(form.getFieldsValue()),
					},
				},
				null,
				4,
			)
			if (newValue !== editorValue) {
				setEditorValue(newValue)
			}
		}
		isUserEditingRef.current = false
	}, [jsonImportEnabled, formName, formType, formServiceConfig, form, editorValue])

	/** MCP type */
	const mcpType = Form.useWatch<MCPType>(MCPFormField.MCPType, form)
	/** Authorization method */
	const authType = Form.useWatch<number>(
		[MCPFormField.ServiceConfig, MCPFormField.AuthType],
		form,
	)

	const { uploading, uploadAndGetFileUrl } = useUpload<FileData>({
		storageType: "public",
	})

	const { run, data, loading } = useRequest(FlowApi.getMcp, {
		manual: true,
		onSuccess(data) {
			setImageUrl(data?.icon)
			toolsPanelRefs.current?.setFormData?.(data?.tools || [])
			form.setFieldsValue(data)
		},
	})
	const { runAsync: saveMcp, loading: saveMcpLoading } = useRequest(FlowApi.saveMcp, {
		manual: true,
	})

	useMount(() => {
		id && run(id)
	})

	const onFileChange = useMemoizedFn(async (fileList: FileList) => {
		const newFiles = Array.from(fileList).map(genFileData)
		// Upload files first
		const { fullfilled } = await uploadAndGetFileUrl(newFiles)
		if (fullfilled.length) {
			const { url, path: key } = fullfilled[0].value
			setImageUrl(url)
			form.setFieldValue(MCPFormField.Icon, key)
		} else {
			magicToast.error(t("mcp.form.uploadFail"))
		}
	})

	// JSON校验函数（基于onSubmit逻辑）
	const validateJson = useMemoizedFn((rawValue: string) => {
		if (!rawValue || !rawValue.trim()) {
			setJsonValidationStatus(null)
			return
		}

		try {
			const mcpSchema = JSON.parse(rawValue)
			if (mcpSchema?.mcpServers && typeof mcpSchema.mcpServers === "object") {
				setJsonValidationStatus("valid")
			} else {
				setJsonValidationStatus("invalid")
			}
		} catch (error) {
			setJsonValidationStatus("invalid")
		}
	})

	// 500ms防抖校验
	const { run: debouncedValidateJson } = useDebounceFn(validateJson, { wait: 500 })

	const options = useMemo(() => {
		return [
			{ value: MCPType.SSE, label: t("mcp.form.options.sse") },
			{ value: MCPType.HTTP, label: t("mcp.form.options.http") },
			{ value: MCPType.STDIO, label: t("mcp.form.options.stdio") },
		]
	}, [t])

	const { run: onFinish } = useThrottleFn(
		() => {
			const values = form.getFieldsValue()
			console.log("values", values)
			const formData = id ? { id, ...values } : values
			// 当且仅当类型为 MCPType.Tool
			if (formData?.type === MCPType.Tool) {
				console.log("特殊处理", toolsPanelRefs.current?.getFormData?.())
				formData.tools = toolsPanelRefs.current?.getFormData?.() || []
			}
			saveMcp(formData)
				.then(() => {
					onSuccessCallback?.()
					onClose?.()
				})
				.catch(console.error)
		},
		{ wait: 1000, trailing: false },
	)

	const { run: triggerDelete } = useThrottleFn(
		async () => {
			try {
				if (id) {
					await FlowApi.deleteMcp(id)
					magicToast.success(t("mcp.page.delete.success"))
					onSuccessCallback?.()
					onClose?.()
				}
			} catch (error: unknown) {
				magicToast.error((error as Error)?.message || "删除失败")
			}
		},
		{ wait: 1000, trailing: false },
	)

	const [toolsCount, setToolsCount] = useState(0)

	// 监听工具变化并更新数量
	useEffect(() => {
		const updateToolsCount = () => {
			const tools = toolsPanelRefs.current?.getFormData?.() || []
			setToolsCount(tools.length)
		}

		// 设置定时器定期检查工具数量变化
		const interval = setInterval(updateToolsCount, 500)

		return () => clearInterval(interval)
	}, [])

	const importTools = useMemo(() => {
		return {
			key: "3",
			label: t("common.tool.importToolsCount", { count: toolsCount }),
			children: <ToolsPanel ref={toolsPanelRefs} details={data} />,
		}
	}, [data, toolsCount, t])

	const headerCollapseItem = useMemo(() => {
		const formItemName =
			mcpType === MCPType.STDIO
				? [MCPFormField.ServiceConfig, MCPFormField.Env]
				: [MCPFormField.ServiceConfig, MCPFormField.Header]
		return {
			key: "1",
			label: mcpType === MCPType.STDIO ? t("mcp.form.env") : "Headers",
			children: (
				<>
					<Form.List name={formItemName}>
						{(fields, { add, remove }) => (
							<>
								{fields.map(({ key, name, ...restField }) => (
									<div key={key} className="flex items-start gap-2.5">
										<Form.Item
											{...restField}
											name={[name, MCPFormField.HeaderKey]}
											className={formItemClassName}
											label={name === 0 ? t("mcp.form.params") : ""}
											rules={[
												{
													required: true,
													message: t("mcp.form.paramsRequired"),
												},
											]}
										>
											<Input
												data-testid="mcp-form-header-key-input"
												placeholder={t("mcp.form.paramsPlaceholder")}
											/>
										</Form.Item>
										<Form.Item
											{...restField}
											name={[name, MCPFormField.HeaderValue]}
											className={formItemClassName}
											label={name === 0 ? t("mcp.form.value") : ""}
											rules={[
												{
													required: true,
													message: t("mcp.form.valueRequired"),
												},
											]}
										>
											<Input
												data-testid="mcp-form-header-value-input"
												placeholder={t("mcp.form.valuePlaceholder")}
											/>
										</Form.Item>
										<Form.Item
											{...restField}
											name={[name, MCPFormField.HeaderMapper]}
											className={formItemClassName}
											label={name === 0 ? t("mcp.form.map") : ""}
										>
											<Input
												data-testid="mcp-form-header-map-input"
												placeholder={t("mcp.form.mapPlaceholder")}
											/>
										</Form.Item>
										<Form.Item
											{...restField}
											className={formItemClassName}
											label={name === 0 ? " " : ""}
										>
											<button
												data-testid="mcp-form-header-remove-button"
												type="button"
												className={iconActionButtonClassName}
												onClick={() => remove(name)}
											>
												<IconCircleMinus size={20} />
											</button>
										</Form.Item>
									</div>
								))}
								<Form.Item className={formItemClassName}>
									<button
										data-testid="mcp-form-header-add-button"
										type="button"
										className={cn(iconActionButtonClassName, "px-3 py-1.5")}
										onClick={() => add()}
									>
										<IconPlus size={18} />
										{t("mcp.form.paramsToCreate")}
									</button>
								</Form.Item>
							</>
						)}
					</Form.List>
				</>
			),
		}
	}, [mcpType, t])

	const authCollapseItem = useMemo(() => {
		return {
			key: "2",
			label: t("mcp.form.authMethod"),
			children: (
				<>
					<Form.Item
						name={[MCPFormField.ServiceConfig, MCPFormField.AuthType]}
						className={formItemClassName}
						getValueFromEvent={(rawValue) => {
							return Number(rawValue) || 0
						}}
						getValueProps={(value) => ({
							value: value?.toString?.() || "0",
						})}
					>
						<Select data-testid="mcp-form-auth-type-select">
							<Select.Option value="0">{t("mcp.form.noAuth")}</Select.Option>
							<Select.Option value="1">OAuth 2.0</Select.Option>
						</Select>
					</Form.Item>
					<Form.Item
						{...SubFormProps}
						hidden={authType !== 1}
						rules={[{ required: authType === 1 }]}
						name={[
							MCPFormField.ServiceConfig,
							MCPFormField.OAuthConfig,
							MCPFormField.ClientId,
						]}
						label="client_id"
						className={formItemClassName}
					>
						<Input
							data-testid="mcp-form-client-id-input"
							placeholder={t("mcp.form.required", { name: "client_id" })}
						/>
					</Form.Item>
					<Form.Item
						{...SubFormProps}
						hidden={authType !== 1}
						rules={[{ required: authType === 1 }]}
						name={[
							MCPFormField.ServiceConfig,
							MCPFormField.OAuthConfig,
							MCPFormField.ClientSecret,
						]}
						label="client_secret"
						className={formItemClassName}
					>
						<Input
							data-testid="mcp-form-client-secret-input"
							placeholder={t("mcp.form.required", { name: "client_secret" })}
						/>
					</Form.Item>
					<Form.Item
						{...SubFormProps}
						hidden={authType !== 1}
						rules={[{ required: authType === 1 }]}
						name={[
							MCPFormField.ServiceConfig,
							MCPFormField.OAuthConfig,
							MCPFormField.ClientUrl,
						]}
						label="client_url"
						className={formItemClassName}
					>
						<Input
							data-testid="mcp-form-client-url-input"
							placeholder={t("mcp.form.required", { name: "client_url" })}
						/>
					</Form.Item>
					<Form.Item
						{...SubFormProps}
						hidden={authType !== 1}
						name={[
							MCPFormField.ServiceConfig,
							MCPFormField.OAuthConfig,
							MCPFormField.Scope,
						]}
						label="scope"
						required={false}
						rules={[]}
						className={formItemClassName}
					>
						<Input
							data-testid="mcp-form-scope-input"
							placeholder={t("mcp.form.required", { name: "scope" })}
						/>
					</Form.Item>
					<Form.Item
						{...SubFormProps}
						hidden={authType !== 1}
						rules={[{ required: authType === 1 }]}
						name={[
							MCPFormField.ServiceConfig,
							MCPFormField.OAuthConfig,
							MCPFormField.AuthorizationUrl,
						]}
						label="authorization_url"
						className={formItemClassName}
					>
						<Input
							data-testid="mcp-form-authorization-url-input"
							placeholder={t("mcp.form.required", { name: "authorization_url" })}
						/>
					</Form.Item>
					<Form.Item
						{...SubFormProps}
						hidden={authType !== 1}
						name="authorization_content_type"
						label="authorization_content_type"
						className={formItemClassName}
						initialValue="application/json"
					>
						<Input
							data-testid="mcp-form-authorization-content-type-input"
							placeholder={t("mcp.form.required", {
								name: "authorization_content_type",
							})}
						/>
					</Form.Item>
				</>
			),
		}
	}, [t, authType])

	const collapseItems = useMemo(() => {
		const mcp = {
			[MCPType.Tool]: [importTools, headerCollapseItem],
			[MCPType.SSE]: [headerCollapseItem, authCollapseItem],
			[MCPType.HTTP]: [headerCollapseItem, authCollapseItem],
			[MCPType.STDIO]: [headerCollapseItem],
		}
		return mcp?.[mcpType]
	}, [authCollapseItem, headerCollapseItem, importTools, mcpType])

	return (
		<div data-testid="mcp-form-root" className="w-full overflow-hidden rounded-[12px]">
			<div className="flex w-full items-center justify-between gap-2.5 border-b border-border px-5 py-2.5 text-base font-semibold leading-[22px] text-foreground/80 backdrop-blur-[12px]">
				{t(id ? "mcp.panel.editTitle" : "mcp.panel.createTitle")}
				<button
					data-testid="mcp-form-close-button"
					type="button"
					className={cn(
						"inline-flex size-6 cursor-pointer items-center justify-center rounded-md",
						"transition-colors hover:bg-fill active:bg-fill-secondary",
						"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
					)}
					onClick={onClose}
				>
					<IconX size={24} />
				</button>
			</div>
			<MagicSpin spinning={loading || saveMcpLoading}>
				<Form
					data-testid="mcp-form-content"
					form={form}
					colon={false}
					validateMessages={{ required: t("form.required", { ns: "interface" }) }}
					layout="vertical"
					preserve={false}
					initialValues={defaultMCPFormValues}
					className={cn(
						"[&_.magic-collapse-header]:!items-center",
						"[&_.magic-collapse-content-box]:!mb-2.5",
						"[&_.magic-collapse-content-box]:!px-0 [&_.magic-collapse-header]:!px-0",
						"[&_.magic-collapse-header-text]:text-xs [&_.magic-collapse-header-text]:text-muted-foreground",
						"[&_.magic-collapse-expand-icon]:!pe-1.5",
					)}
				>
					<ScrollArea
						className="h-[60vh] w-full"
						viewportClassName="p-2.5 [&>div]:!block"
					>
						<Form.Item name={MCPFormField.Icon} className={formItemClassName}>
							<div className="mt-1 flex flex-col items-center gap-2.5 overflow-hidden rounded-[12px] border border-border py-5">
								{imageUrl ? (
									<MagicAvatar
										src={imageUrl}
										size={100}
										style={{ borderRadius: 20 }}
									/>
								) : (
									<div className="flex size-[100px] items-center justify-center overflow-hidden rounded-[20px] bg-muted text-foreground">
										<IconMCP size={78} />
									</div>
								)}
								<Form.Item name="icon" noStyle>
									<UploadButton
										data-testid="mcp-form-icon-upload-button"
										className="inline-flex h-8 items-center justify-center gap-1 rounded-full border border-border bg-muted px-5 font-bold"
										loading={uploading}
										onFileChange={onFileChange}
									/>
								</Form.Item>
							</div>
						</Form.Item>
						<Form.Item
							name={MCPFormField.Name}
							label={t("mcp.form.name")}
							required
							rules={[{ required: true }]}
							className={formItemClassName}
						>
							<Input
								data-testid="mcp-form-name-input"
								placeholder={t("mcp.form.required", { name: t("mcp.form.name") })}
							/>
						</Form.Item>
						<Form.Item
							name={MCPFormField.Description}
							label={t("mcp.form.desc")}
							className={formItemClassName}
						>
							<Textarea
								data-testid="mcp-form-description-input"
								className="min-h-20"
								placeholder={t("mcp.form.required", { name: t("mcp.form.desc") })}
							/>
						</Form.Item>
						<Form.Item className={formItemClassName} required>
							<div className="flex items-stretch gap-2.5">
								<button
									type="button"
									data-testid="mcp-form-import-tools-card"
									className={cn(
										optionCardClassName,
										mcpType === MCPType.Tool && optionCardSelectedClassName,
									)}
									onClick={() => {
										form.setFieldValue(MCPFormField.MCPType, MCPType.Tool)
									}}
								>
									<div
										className={cn(
											"flex size-5 items-start justify-center text-foreground/80",
											mcpType === MCPType.Tool && "text-primary",
										)}
									>
										<IconPackageImport size={20} />
									</div>
									<div className="flex flex-1 flex-col gap-0.5">
										<div
											className={cn(
												"text-sm font-semibold leading-[1.43] text-foreground/80",
												mcpType === MCPType.Tool && "text-primary",
											)}
										>
											{t("common.tool.panel.importExistingToolsTitle")}
										</div>
										<div className="text-[10px] font-normal leading-[1.3] text-muted-foreground">
											{t("common.tool.panel.importExistingToolsDesc")}
										</div>
									</div>
								</button>

								<button
									type="button"
									data-testid="mcp-form-custom-mcp-card"
									className={cn(
										optionCardClassName,
										mcpType !== MCPType.Tool && optionCardSelectedClassName,
									)}
									onClick={() => {
										if (mcpType === MCPType.Tool) {
											form.setFieldValue(MCPFormField.MCPType, MCPType.SSE)
										}
									}}
								>
									<div
										className={cn(
											"flex size-5 items-start justify-center text-foreground/80",
											mcpType !== MCPType.Tool && "text-primary",
										)}
									>
										<svg
											width="20"
											height="20"
											viewBox="0 0 20 20"
											fill="none"
											xmlns="http://www.w3.org/2000/svg"
										>
											<path
												d="M3.33325 8.39547L8.75887 3.17375C9.31534 2.63819 10.7887 1.91391 12.2302 3.30127C13.6717 4.68862 12.9192 6.10658 12.3627 6.64215M12.3627 6.64215L8.6065 10.2572M12.3627 6.64215C12.9192 6.10658 14.3925 5.3823 15.834 6.76966C17.2756 8.15702 16.523 9.57498 15.9665 10.1105L10.5409 15.3323L12.7933 17.5M10.4283 4.9813L6.335 8.92076C5.92567 9.3147 5.46176 10.444 6.88077 11.8097C8.29978 13.1754 9.47319 12.7289 9.88252 12.335L13.9758 8.3955"
												stroke="currentColor"
												strokeOpacity="0.8"
												strokeWidth="1.5"
												strokeLinecap="round"
												strokeLinejoin="round"
											/>
										</svg>
									</div>
									<div className="flex flex-1 flex-col gap-0.5">
										<div
											className={cn(
												"text-sm font-semibold leading-[1.43] text-foreground/80",
												mcpType !== MCPType.Tool && "text-primary",
											)}
										>
											{t("common.tool.panel.customMcpTitle")}
										</div>
										<div className="text-[10px] font-normal leading-[1.3] text-muted-foreground">
											{t("common.tool.panel.customMcpDesc")}
										</div>
									</div>
								</button>
							</div>

							{mcpType !== MCPType.Tool && (
								<div className="mt-4">
									<div className="flex items-center justify-end gap-1.5">
										<Switch
											data-testid="mcp-form-json-import-switch"
											checked={jsonImportEnabled}
											onCheckedChange={setJsonImportEnabled}
										/>
										<span className="text-xs font-normal leading-4 text-foreground/80">
											{t("common.tool.panel.importViaJson")}
										</span>
									</div>

									{jsonImportEnabled && (
										<div
											data-testid="mcp-form-json-editor-section"
											className="mt-4 overflow-hidden rounded-[12px] bg-[#1c1d23]"
										>
											<div className="relative w-full rounded-md">
												<Editor
													value={editorValue}
													onValueChange={(rawValue: string) => {
														// Mark as user-driven input
														isUserEditingRef.current = true
														setEditorValue(rawValue)

														if (!rawValue) {
															debouncedValidateJson("")
															return
														}

														debouncedValidateJson(rawValue)
														try {
															const result = JSON.parse(rawValue)
															const mcpName = Object.keys(
																result?.mcpServers,
															)?.[0]
															const formData = {
																name: mcpName,
																...(result?.mcpServers?.[mcpName] ||
																	{}),
															}
															if (
																formData?.[MCPFormField.Command] ||
																formData?.[MCPFormField.Arguments]
															) {
																formData.type = MCPType.STDIO
																set(
																	formData,
																	[
																		MCPFormField.ServiceConfig,
																		MCPFormField.Command,
																	],
																	formData?.command || "",
																)
																set(
																	formData,
																	[
																		MCPFormField.ServiceConfig,
																		MCPFormField.Arguments,
																	],
																	formData?.args?.join(" ") || "",
																)
																if (formData?.env) {
																	set(
																		formData,
																		[
																			MCPFormField.ServiceConfig,
																			MCPFormField.Env,
																		],
																		importHeaders(
																			formData?.env,
																		),
																	)
																}
																form.setFieldValue(
																	MCPFormField.MCPType,
																	MCPType.STDIO,
																)
															}
															if (formData.type === MCPType.Tool) {
																formData.type = MCPType.SSE
																form.setFieldValue(
																	MCPFormField.MCPType,
																	MCPType.SSE,
																)
															}
															if (
																formData.type === "streamable-http"
															) {
																formData.type = MCPType.HTTP
																form.setFieldValue(
																	MCPFormField.MCPType,
																	MCPType.HTTP,
																)
															}
															if (formData?.headers) {
																set(
																	formData,
																	[
																		MCPFormField.ServiceConfig,
																		MCPFormField.Header,
																	],
																	importHeaders(
																		formData?.headers,
																	),
																)
															}
															if (formData?.url) {
																set(
																	formData,
																	[
																		MCPFormField.ServiceConfig,
																		MCPFormField.Url,
																	],
																	formData.url,
																)
															}
															form.setFieldsValue(formData)
														} catch (error) {
															console.log(
																"JSON formatting failed",
																error,
															)
														}
													}}
													highlight={(code: string) => {
														try {
															const highlighted = highlight(
																code,
																languages.json,
																"json",
															)
															return (
																<span
																	dangerouslySetInnerHTML={{
																		__html: highlighted,
																	}}
																/>
															)
														} catch (error) {
															console.warn(
																"Syntax highlighting failed:",
																error,
															)
															return <span>{code}</span>
														}
													}}
													padding={12}
													readOnly={false}
													disabled={false}
													style={{
														fontFamily:
															"'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
														fontSize: 12,
														backgroundColor: "rgba(28,29,35, 1)",
														color: "#d4d4d4",
														borderRadius: "6px",
														minHeight: "100px",
													}}
													textareaClassName="!resize-none !border-none !bg-transparent !outline-none !pointer-events-auto !select-text"
													preClassName="!m-0"
												/>
											</div>
											{jsonValidationStatus && (
												<div
													data-testid="mcp-form-json-validator-status"
													className="flex items-center justify-between gap-5 rounded-b-[12px] border border-[#34363f] bg-[#1c1d23] px-5 py-2.5"
												>
													<div className="flex items-center gap-1">
														{jsonValidationStatus === "valid" ? (
															<>
																<IconCheck
																	size={16}
																	className="text-green-500 dark:text-green-400"
																/>
																<span className="text-xs font-normal leading-4 text-white">
																	{t(
																		"common.tool.panel.jsonValidationPassed",
																	)}
																</span>
															</>
														) : (
															<>
																<IconX
																	size={16}
																	className="text-destructive"
																/>
																<span className="text-xs font-normal leading-4 text-white">
																	{t(
																		"common.tool.panel.jsonValidationFailed",
																	)}
																</span>
															</>
														)}
													</div>
												</div>
											)}
										</div>
									)}
								</div>
							)}
						</Form.Item>

						{/* Custom MCP form items */}
						<Form.Item
							hidden={mcpType === MCPType.Tool || jsonImportEnabled}
							name={MCPFormField.MCPType}
							label={t("mcp.form.type")}
							className={formItemClassName}
							initialValue={MCPType.Tool}
						>
							<Select data-testid="mcp-form-type-select" options={options} />
						</Form.Item>

						{[MCPType.SSE, MCPType.HTTP].includes(mcpType) && (
							<Form.Item
								hidden={jsonImportEnabled}
								name={[MCPFormField.ServiceConfig, MCPFormField.Url]}
								label={t("mcp.form.url")}
								className={formItemClassName}
								required
								rules={[{ required: true }]}
							>
								<Input
									data-testid="mcp-form-url-input"
									placeholder={t("mcp.form.required", {
										name: t("mcp.form.url"),
									})}
								/>
							</Form.Item>
						)}

						{mcpType === MCPType.STDIO && (
							<>
								<Form.Item
									hidden={jsonImportEnabled}
									name={[MCPFormField.ServiceConfig, MCPFormField.Command]}
									label={t("mcp.form.command")}
									className={formItemClassName}
									required
									rules={[{ required: true }]}
									initialValue="npx"
								>
									<Input
										data-testid="mcp-form-command-input"
										placeholder={t("mcp.form.commandPlaceholder")}
									/>
								</Form.Item>
								<Form.Item
									hidden={jsonImportEnabled}
									name={[MCPFormField.ServiceConfig, MCPFormField.Arguments]}
									label={t("mcp.form.args")}
									className={formItemClassName}
									required
									rules={[{ required: true }]}
								>
									<Input
										data-testid="mcp-form-args-input"
										placeholder={t("mcp.form.argsPlaceholder")}
									/>
								</Form.Item>
							</>
						)}

						<Collapse
							data-testid="mcp-form-collapse"
							ghost
							defaultActiveKey={["1", "2", "3"]}
							expandIcon={({ isActive }) => {
								return (
									<IconChevronDown
										size={16}
										style={{
											transform: isActive ? "unset" : "rotate(-90deg)",
										}}
									/>
								)
							}}
							items={collapseItems}
							className="w-full"
						/>
					</ScrollArea>
					<div className="flex justify-end gap-2.5 p-2.5">
						{id && (
							<Popconfirm
								placement="top"
								title={t("mcp.page.delete.title")}
								description={t("mcp.page.delete.content", { name: data?.name })}
								okText={t("mcp.page.delete.confirm")}
								cancelText={t("mcp.page.delete.cancel")}
								onConfirm={() => triggerDelete()}
							>
								<Button
									data-testid="mcp-form-delete-button"
									type="button"
									variant="destructive"
									className="mr-auto"
								>
									{t("mcp.form.delete")}
								</Button>
							</Popconfirm>
						)}
						<Button
							data-testid="mcp-form-cancel-button"
							type="button"
							variant="outline"
							onClick={() => onClose?.()}
						>
							{t("mcp.form.cancel")}
						</Button>
						<Button
							data-testid="mcp-form-submit-button"
							type="button"
							onClick={onFinish}
						>
							{t(id ? "mcp.form.save" : "mcp.form.confirm")}
						</Button>
					</div>
				</Form>
			</MagicSpin>
		</div>
	)
}

import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useRequest } from "ahooks"
import SimpleCodeEditor from "react-simple-code-editor"
import { IconMCP } from "@/enhance/tabler/icons-react"
import { Loader2, Plus, Trash2, Upload, X } from "lucide-react"
import { IconChevronRight, IconTools } from "@tabler/icons-react"
import { FlowApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import { useUpload } from "@/hooks/useUploadFiles"
import type { FileData } from "@/pages/chatNew/components/MessageEditor/components/InputFiles/types"
import { genFileData } from "@/pages/chatNew/components/MessageEditor/components/InputFiles/utils"
import type { Flow, UseableToolSet } from "@/types/flow"
import type { IMCPItem } from "@/components/Agent/MCP/types"
import defaultToolAvatar from "@/assets/logos/tool-avatar.png"
import { MCPType } from "@/components/Agent/MCP/types"
import {
	MCPConfigToJson,
	MCPFormField,
	highlightJsonCode,
	importHeaders,
} from "@/components/Agent/MCP/MCPForm/helpers"
import { cn } from "@/utils/cn"
import { Button } from "@/components/shadcn-ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/shadcn-ui/dialog"
import { Input } from "@/components/shadcn-ui/input"
import { Label } from "@/components/shadcn-ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/shadcn-ui/radio-group"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import { Separator } from "@/components/shadcn-ui/separator"
import { Switch } from "@/components/shadcn-ui/switch"
import { Textarea } from "@/components/shadcn-ui/textarea"

interface KeyValueRow {
	key: string
	value: string
	mapper_system_input?: string
}

interface OAuthConfig {
	client_id: string
	client_secret: string
	client_url: string
	scope: string
	authorization_url: string
	/** Token 请求方法，后端仅接受 GET / POST */
	authorization_method: string
}

interface MCPAuthorizationConfig {
	resource: string
	resource_metadata_url: string
	authorization_server_url: string
	authorization_endpoint: string
	token_endpoint: string
	registration_endpoint: string
	registration_mode: "auto" | "pre_registered" | "cimd" | "dcr"
	client_id: string
	client_secret: string
	client_metadata_url: string
	token_endpoint_auth_method: "" | "none" | "client_secret_basic" | "client_secret_post"
	application_type: "native" | "web"
	scope: string
	redirect_uri: string
	additional_params: KeyValueRow[]
}

interface ConnectorMCPFormState {
	id?: string
	icon: string
	name: string
	description: string
	type: MCPType
	service_config: {
		url: string
		command: string
		arguments: string
		headers: KeyValueRow[]
		env: KeyValueRow[]
		auth_type: number
		oauth2_config: OAuthConfig
		mcp_authorization_config: MCPAuthorizationConfig
	}
	authorization_content_type: string
	tools: Flow.Mcp.ListItem[]
}

interface ConnectorMCPFormProps {
	onClose?: () => void
	onSuccessCallback?: () => void
	connector?: IMCPItem | null
	/** z-index for floating children that must sit above the parent dialog */
	nestedLayerZIndex?: number
}

const emptyOAuthConfig = (): OAuthConfig => ({
	client_id: "",
	client_secret: "",
	client_url: "",
	scope: "",
	authorization_url: "",
	authorization_method: "POST",
})

const emptyMCPAuthorizationConfig = (): MCPAuthorizationConfig => ({
	resource: "",
	resource_metadata_url: "",
	authorization_server_url: "",
	authorization_endpoint: "",
	token_endpoint: "",
	registration_endpoint: "",
	registration_mode: "auto",
	client_id: "",
	client_secret: "",
	client_metadata_url: "",
	token_endpoint_auth_method: "",
	application_type: "native",
	scope: "",
	redirect_uri: "",
	additional_params: [],
})

const createInitialState = (): ConnectorMCPFormState => ({
	icon: "",
	name: "",
	description: "",
	type: MCPType.HTTP,
	service_config: {
		url: "",
		command: "npx",
		arguments: "",
		headers: [],
		env: [],
		auth_type: 0,
		oauth2_config: emptyOAuthConfig(),
		mcp_authorization_config: emptyMCPAuthorizationConfig(),
	},
	authorization_content_type: "application/json",
	tools: [],
})

function isInitialCreateState(state: ConnectorMCPFormState) {
	return JSON.stringify(state) === JSON.stringify(createInitialState())
}

const inputClassName = "h-9 bg-background"
const fieldClassName = "flex flex-col gap-1.5"

const oauthLabelKeys = {
	client_id: "clientId",
	client_secret: "clientSecret",
	client_url: "clientUrl",
	scope: "scope",
	authorization_url: "authorizationUrl",
	authorization_method: "authorizationMethod",
	authorization_content_type: "authorizationContentType",
} as const

const mcpAuthorizationLabelKeys = {
	resource: "resource",
	resource_metadata_url: "resourceMetadataUrl",
	authorization_server_url: "authorizationServerUrl",
	authorization_endpoint: "authorizationEndpoint",
	token_endpoint: "tokenEndpoint",
	registration_endpoint: "registrationEndpoint",
	registration_mode: "registrationMode",
	client_id: "clientId",
	client_secret: "clientSecret",
	client_metadata_url: "clientMetadataUrl",
	token_endpoint_auth_method: "tokenEndpointAuthMethod",
	application_type: "applicationType",
	scope: "scope",
	additional_params: "additionalParams",
} as const

const Editor = ((SimpleCodeEditor as unknown as { default?: typeof SimpleCodeEditor }).default ??
	SimpleCodeEditor) as typeof SimpleCodeEditor

function updateNestedState(
	setState: React.Dispatch<React.SetStateAction<ConnectorMCPFormState>>,
	key: keyof ConnectorMCPFormState["service_config"],
	value: string | number | KeyValueRow[] | OAuthConfig | MCPAuthorizationConfig,
) {
	setState((current) => ({
		...current,
		service_config: { ...current.service_config, [key]: value },
	}))
}

function toStringValue(value: unknown) {
	if (typeof value === "string") return value
	if (value === null || value === undefined) return ""
	return String(value)
}

function toKeyValueRows(value: unknown): KeyValueRow[] {
	if (Array.isArray(value)) {
		return value.map((item) => {
			const row = item as Partial<KeyValueRow>
			return {
				key: toStringValue(row.key),
				value: toStringValue(row.value),
				mapper_system_input: row.mapper_system_input,
			}
		})
	}
	if (value && typeof value === "object") {
		return importHeaders(value as Record<string, string>) as unknown as KeyValueRow[]
	}
	return []
}

function keyValueRowsToObject(rows: KeyValueRow[]) {
	return rows.reduce<Record<string, string>>((result, item) => {
		const key = item.key.trim()
		if (key) result[key] = item.value
		return result
	}, {})
}

function serializeMCPAuthorizationConfig(config: MCPAuthorizationConfig) {
	const result: Record<string, unknown> = {}
	for (const key of [
		"resource",
		"resource_metadata_url",
		"authorization_server_url",
		"authorization_endpoint",
		"token_endpoint",
		"registration_endpoint",
		"registration_mode",
		"client_id",
		"client_secret",
		"client_metadata_url",
		"token_endpoint_auth_method",
		"application_type",
		"scope",
	] as const) {
		const value = config[key]
		if (typeof value === "string" && value.trim()) result[key] = value
	}
	const additionalParams = keyValueRowsToObject(config.additional_params)
	if (Object.keys(additionalParams).length) result.additional_params = additionalParams
	return result
}

function configToState(raw: Record<string, any>): ConnectorMCPFormState {
	const next = createInitialState()
	const name = Object.keys(raw?.mcpServers || {})[0]
	const config = (name && raw.mcpServers[name]) || raw
	const serviceConfig = config?.service_config || config?.serviceConfig || {}
	const rawType = config?.type
	const hasCommand =
		(typeof config?.command === "string" && Boolean(config.command.trim())) ||
		(Array.isArray(config?.args) && config.args.length > 0)
	const hasUrl = typeof config?.url === "string" && Boolean(config.url.trim())
	// MCPType.Tool and the legacy "sse" value are the same string. A JSON MCP
	// definition with an explicit type of "sse" is an SSE connector, while
	// imported tool-set records carry tool metadata that lets us identify them.
	const isImportedToolConfig =
		rawType === MCPType.Tool &&
		(Array.isArray(config?.tools) ||
			config?.source === 1 ||
			Boolean(config?.rel_info?.tool_set_id))

	next.id = config?.id
	next.name = toStringValue(config?.name || name)
	next.description = toStringValue(config?.description)
	next.icon = toStringValue(config?.icon)
	next.type =
		rawType === MCPType.Tool && isImportedToolConfig
			? MCPType.Tool
			: rawType === MCPType.HTTP || rawType === "streamable-http" || rawType === "http"
				? MCPType.HTTP
				: rawType === MCPType.STDIO || rawType === "stdio"
					? MCPType.STDIO
					: hasCommand
						? MCPType.STDIO
						: hasUrl && !rawType
							? MCPType.HTTP
							: MCPType.SSE
	next.service_config.url = toStringValue(
		serviceConfig.url || config?.url || config?.external_sse_url,
	)
	next.service_config.command = toStringValue(serviceConfig.command || config?.command || "npx")
	const argumentsValue = serviceConfig.arguments ?? config?.args
	next.service_config.arguments = Array.isArray(argumentsValue)
		? argumentsValue.map(toStringValue).join(",")
		: toStringValue(argumentsValue)
	next.service_config.headers = toKeyValueRows(serviceConfig.headers || config?.headers)
	next.service_config.env = toKeyValueRows(serviceConfig.env || config?.env)
	next.service_config.auth_type = Number(serviceConfig.auth_type ?? config?.auth_type ?? 0)
	const rawOAuthConfig = serviceConfig.oauth2_config || config?.oauth2_config || {}
	next.service_config.oauth2_config = {
		client_id: toStringValue(rawOAuthConfig.client_id),
		client_secret: toStringValue(rawOAuthConfig.client_secret),
		client_url: toStringValue(rawOAuthConfig.client_url),
		scope: toStringValue(rawOAuthConfig.scope),
		authorization_url: toStringValue(rawOAuthConfig.authorization_url),
		// 后端只接受 GET/POST，历史连接器缺少该字段时回填 POST，避免编辑旧数据时被改写。
		authorization_method:
			toStringValue(rawOAuthConfig.authorization_method).toUpperCase() === "GET"
				? "GET"
				: "POST",
	}
	const rawMCPAuthorizationConfig =
		serviceConfig.mcp_authorization_config || config?.mcp_authorization_config || {}
	next.service_config.mcp_authorization_config = {
		resource: toStringValue(rawMCPAuthorizationConfig.resource),
		resource_metadata_url: toStringValue(rawMCPAuthorizationConfig.resource_metadata_url),
		authorization_server_url: toStringValue(rawMCPAuthorizationConfig.authorization_server_url),
		authorization_endpoint: toStringValue(rawMCPAuthorizationConfig.authorization_endpoint),
		token_endpoint: toStringValue(rawMCPAuthorizationConfig.token_endpoint),
		registration_endpoint: toStringValue(rawMCPAuthorizationConfig.registration_endpoint),
		registration_mode: ["auto", "pre_registered", "cimd", "dcr"].includes(
			rawMCPAuthorizationConfig.registration_mode,
		)
			? rawMCPAuthorizationConfig.registration_mode
			: "auto",
		client_id: toStringValue(rawMCPAuthorizationConfig.client_id),
		client_secret: toStringValue(rawMCPAuthorizationConfig.client_secret),
		client_metadata_url: toStringValue(rawMCPAuthorizationConfig.client_metadata_url),
		token_endpoint_auth_method: ["none", "client_secret_basic", "client_secret_post"].includes(
			rawMCPAuthorizationConfig.token_endpoint_auth_method,
		)
			? rawMCPAuthorizationConfig.token_endpoint_auth_method
			: "",
		application_type: rawMCPAuthorizationConfig.application_type === "web" ? "web" : "native",
		scope: toStringValue(rawMCPAuthorizationConfig.scope),
		redirect_uri: toStringValue(rawMCPAuthorizationConfig.redirect_uri),
		additional_params: toKeyValueRows(rawMCPAuthorizationConfig.additional_params),
	}
	next.authorization_content_type = toStringValue(
		serviceConfig.authorization_content_type ||
			serviceConfig.oauth2_config?.authorization_content_type ||
			config?.oauth2_config?.authorization_content_type ||
			config?.authorization_content_type ||
			"application/json",
	)
	next.tools = Array.isArray(config?.tools) ? config.tools : []
	return next
}

function stateToJsonConfig(state: ConnectorMCPFormState) {
	const config = MCPConfigToJson(state as unknown as Record<string, unknown>)
	const oauthConfig = state.service_config.oauth2_config
	const nextConfig: Record<string, unknown> = {}
	const setStringIfFilled = (key: string, value: string) => {
		if (value.trim()) nextConfig[key] = value
	}

	setStringIfFilled("icon", state.icon)
	setStringIfFilled("name", state.name)
	setStringIfFilled("description", state.description)

	if (state.type === MCPType.STDIO) {
		nextConfig.type = "stdio"
		setStringIfFilled("command", state.service_config.command)
		const args = state.service_config.arguments
			.split(",")
			.map((item) => item.trim())
			.filter(Boolean)
		if (args.length) nextConfig.args = args
		const env = config.env as Record<string, string> | undefined
		if (env && Object.keys(env).length) nextConfig.env = env
		return nextConfig
	}

	if (state.type === MCPType.HTTP) nextConfig.type = "streamable-http"
	setStringIfFilled("url", state.service_config.url)
	const headers = config.headers as Record<string, string> | undefined
	if (headers && Object.keys(headers).length) nextConfig.headers = headers

	if (state.service_config.auth_type === 1) {
		nextConfig.auth_type = 1
		const nextOAuthConfig: Record<string, string> = {}
		for (const [key, value] of Object.entries({
			...oauthConfig,
			authorization_content_type: state.authorization_content_type,
		})) {
			if (typeof value === "string" && value.trim()) nextOAuthConfig[key] = value
		}
		if (Object.keys(nextOAuthConfig).length) nextConfig.oauth2_config = nextOAuthConfig
	}

	if (state.service_config.auth_type === 2) {
		nextConfig.auth_type = 2
		const authorizationConfig = serializeMCPAuthorizationConfig(
			state.service_config.mcp_authorization_config,
		)
		if (Object.keys(authorizationConfig).length)
			nextConfig.mcp_authorization_config = authorizationConfig
	}

	return nextConfig
}

function parseJsonValue(raw: string) {
	const parsed = JSON.parse(raw) as Record<string, any>
	if (
		!parsed?.mcpServers ||
		typeof parsed.mcpServers !== "object" ||
		Array.isArray(parsed.mcpServers)
	) {
		throw new Error("Invalid MCP JSON")
	}
	return configToState(parsed)
}

function KeyValueEditor({
	rows,
	onChange,
	placeholder,
	keyLabel,
	removeLabel,
	addLabel,
}: {
	rows: KeyValueRow[]
	onChange: (rows: KeyValueRow[]) => void
	placeholder: string
	keyLabel: string
	removeLabel: string
	addLabel: string
}) {
	return (
		<div className="flex flex-col gap-2">
			{rows.map((row, index) => (
				<div className="grid grid-cols-[1fr_1fr_auto] gap-2" key={`${index}-${row.key}`}>
					<Input
						value={row.key}
						className={inputClassName}
						placeholder={keyLabel}
						onChange={(event) => {
							const next = [...rows]
							next[index] = { ...row, key: event.target.value }
							onChange(next)
						}}
					/>
					<Input
						value={row.value}
						className={inputClassName}
						placeholder={placeholder}
						onChange={(event) => {
							const next = [...rows]
							next[index] = { ...row, value: event.target.value }
							onChange(next)
						}}
					/>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
						onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
						aria-label={removeLabel}
					>
						<Trash2 className="size-4" />
					</Button>
				</div>
			))}
			<Button
				type="button"
				variant="outline"
				className="w-fit gap-1.5"
				onClick={() => onChange([...rows, { key: "", value: "" }])}
			>
				<Plus className="size-4" />
				{addLabel}
			</Button>
		</div>
	)
}

function ToolImportDialog({
	open,
	onOpenChange,
	selectedTools,
	onToggle,
	zIndex,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	selectedTools: Flow.Mcp.ListItem[]
	onToggle: (tool: UseableToolSet.UsableTool, toolsetId: string, selected: boolean) => void
	zIndex?: number
}) {
	const { t } = useTranslation("agent")
	const { t: tMarket } = useTranslation("crew/market")
	const [toolSets, setToolSets] = useState<UseableToolSet.Item[]>([])
	const [query, setQuery] = useState("")
	const [expandedToolSetIds, setExpandedToolSetIds] = useState<Set<string>>(() => new Set())
	const { run, loading } = useRequest(FlowApi.getUseableToolList, {
		manual: true,
		onSuccess: (data) => setToolSets(data?.list || []),
	})
	useEffect(() => {
		if (open) void run()
	}, [open, run])
	const selectedCodes = useMemo(
		() => new Set(selectedTools.map((tool) => tool.rel_code)),
		[selectedTools],
	)
	const filteredToolSets = useMemo(() => {
		const keyword = query.trim().toLowerCase()
		if (!keyword) return toolSets
		return toolSets
			.map((toolSet) => ({
				...toolSet,
				tools: toolSet.tools.filter((tool) =>
					[tool.name, tool.description].some((value) =>
						value?.toLowerCase().includes(keyword),
					),
				),
			}))
			.filter((toolSet) => toolSet.tools.length > 0)
	}, [query, toolSets])

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton={false}
				aria-describedby={undefined}
				className="!max-h-[calc(100%-2rem)] !w-[calc(100%-2rem)] !min-w-0 !max-w-[760px] !gap-0 !overflow-hidden !rounded-xl !border !bg-background !p-0 !shadow-sm"
				style={zIndex ? { zIndex } : undefined}
				data-testid="connector-tool-import-dialog"
			>
				<DialogTitle className="sr-only">
					{t("common.tool.importExistingTools")}
				</DialogTitle>
				<div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3">
					<div className="text-base font-semibold text-foreground">
						{t("common.tool.importExistingTools")}
					</div>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-8"
						onClick={() => onOpenChange(false)}
						aria-label={tMarket("connectors.createForm.close")}
					>
						<X className="size-5" />
					</Button>
				</div>
				<ScrollArea
					className="h-[min(68vh,680px)] w-full min-w-0"
					viewportClassName="min-w-0 overflow-x-hidden px-5 py-4 [&>div]:!block [&>div]:!w-full [&>div]:!min-w-0"
				>
					<div className="flex w-full min-w-0 flex-col gap-4">
						<Input
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder={t("common.tool.menu.search")}
						/>
						{loading ? (
							<div className="py-12 text-center text-sm text-muted-foreground">
								{tMarket("connectors.createForm.loading")}
							</div>
						) : filteredToolSets.length === 0 ? (
							<div className="py-12 text-center text-sm text-muted-foreground">
								{t("common.tool.panel.emptyState")}
							</div>
						) : (
							<div className="flex w-full min-w-0 flex-col gap-2">
								{filteredToolSets.map((toolSet) => (
									<div
										key={toolSet.id}
										className="min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-background"
									>
										<button
											type="button"
											className="flex w-full min-w-0 items-center gap-2.5 p-2.5 text-left transition-colors hover:bg-muted/30"
											onClick={() =>
												setExpandedToolSetIds((current) => {
													const next = new Set(current)
													if (next.has(toolSet.id))
														next.delete(toolSet.id)
													else next.add(toolSet.id)
													return next
												})
											}
											aria-expanded={expandedToolSetIds.has(toolSet.id)}
										>
											<img
												src={toolSet.icon || defaultToolAvatar}
												alt=""
												className="size-10 shrink-0 rounded-lg object-cover"
												onError={(event) => {
													event.currentTarget.src = defaultToolAvatar
												}}
											/>
											<span className="min-w-0 flex-1">
												<span className="block truncate text-sm font-semibold text-foreground">
													{toolSet.name}
												</span>
												{toolSet.description ? (
													<span className="mt-0.5 block truncate text-xs text-muted-foreground">
														{toolSet.description}
													</span>
												) : null}
											</span>
											<span className="hidden shrink-0 items-center gap-1.5 sm:flex">
												<span className="flex h-6 items-center gap-1 rounded-md bg-muted/60 px-1.5 text-xs text-muted-foreground">
													<IconTools className="size-3.5 text-foreground/70" />
													{t("common.tool.card.toolsCount", {
														count: toolSet.tools.length,
													})}
												</span>
											</span>
											<IconChevronRight
												className={cn(
													"size-5 shrink-0 text-foreground transition-transform",
													expandedToolSetIds.has(toolSet.id) &&
														"rotate-90",
												)}
											/>
										</button>
										{expandedToolSetIds.has(toolSet.id) ? (
											<div className="w-full min-w-0 rounded-b-xl border-t border-border bg-muted/60 px-2.5 pb-2.5 pt-3">
												<div className="mb-2 text-sm font-semibold">
													{t("common.tool.card.groupTitle", {
														count: toolSet.tools.length,
													})}
												</div>
												<div className="flex min-w-0 flex-col gap-2">
													{toolSet.tools.map((tool) => {
														const selected = selectedCodes.has(
															tool.code,
														)
														return (
															<div
																key={tool.code}
																className="flex w-full min-w-0 max-w-full items-center justify-between gap-2 rounded-lg bg-white px-3 py-3"
															>
																<div className="min-w-0">
																	<div className="truncate text-sm font-semibold">
																		{tool.name}
																	</div>
																	<div className="mt-0.5 truncate text-xs text-muted-foreground">
																		{tool.description}
																	</div>
																</div>
																<Button
																	type="button"
																	variant={
																		selected
																			? "destructive"
																			: "outline"
																	}
																	className={cn(
																		"h-8 shrink-0 gap-1 px-3 text-xs",
																		selected &&
																			"bg-destructive/10 text-destructive hover:bg-destructive/15",
																	)}
																	onClick={() =>
																		onToggle(
																			tool,
																			toolSet.id,
																			selected,
																		)
																	}
																>
																	{!selected && (
																		<Plus className="size-4" />
																	)}
																	{t(
																		selected
																			? "common.tool.card.remove"
																			: "common.tool.card.add",
																	)}
																</Button>
															</div>
														)
													})}
												</div>
											</div>
										) : null}
									</div>
								))}
							</div>
						)}
					</div>
				</ScrollArea>
				<Separator />
				<div className="flex shrink-0 justify-end gap-2 px-5 py-3">
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
						{tMarket("connectors.createForm.close")}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}

export default function ConnectorMCPForm({
	onClose,
	onSuccessCallback,
	connector = null,
	nestedLayerZIndex,
}: ConnectorMCPFormProps) {
	const { t } = useTranslation("agent")
	const { t: tMarket } = useTranslation("crew/market")
	const [state, setState] = useState(createInitialState)
	const [iconPreviewUrl, setIconPreviewUrl] = useState("")
	const [jsonImportEnabled, setJsonImportEnabled] = useState(true)
	const [jsonValue, setJsonValue] = useState("")
	const [jsonError, setJsonError] = useState("")
	const [errors, setErrors] = useState<Record<string, string>>({})
	const [toolDialogOpen, setToolDialogOpen] = useState(false)
	const [loadingInitialData, setLoadingInitialData] = useState(Boolean(connector))
	const fileInputRef = useRef<HTMLInputElement>(null)
	const isJsonEditingRef = useRef(false)
	const { uploading, uploadAndGetFileUrl } = useUpload<FileData>({ storageType: "public" })
	const { runAsync: saveMcp, loading: saving } = useRequest(FlowApi.saveMcp, { manual: true })

	useEffect(() => {
		if (!connector) {
			isJsonEditingRef.current = false
			setLoadingInitialData(false)
			setState(createInitialState())
			setIconPreviewUrl("")
			setErrors({})
			return
		}

		let disposed = false
		isJsonEditingRef.current = false
		setLoadingInitialData(true)
		setErrors({})
		void FlowApi.getMcp(connector.id)
			.then((data) => {
				if (disposed) return
				const nextState = configToState(data as unknown as Record<string, any>)
				setState(nextState)
				setIconPreviewUrl(nextState.icon || "")
			})
			.catch(() => {
				if (!disposed) magicToast.error(tMarket("connectors.createForm.loadFailed"))
			})
			.finally(() => {
				if (!disposed) setLoadingInitialData(false)
			})

		return () => {
			disposed = true
		}
	}, [connector, tMarket])

	useEffect(() => {
		if (!jsonImportEnabled || state.type === MCPType.Tool) {
			isJsonEditingRef.current = false
			setJsonValue("")
			setJsonError("")
			setErrors(getStateValidationErrors(state))
			return
		}
		if (isJsonEditingRef.current) {
			isJsonEditingRef.current = false
			return
		}
		const jsonDocument =
			!connector && isInitialCreateState(state)
				? { mcpServers: { mcp_name: { url: "" } } }
				: { mcpServers: { [state.name || "mcp_name"]: stateToJsonConfig(state) } }
		setJsonValue(JSON.stringify(jsonDocument, null, 2))
		setErrors({})
		setJsonError("")
	}, [connector, jsonImportEnabled, state])

	const updateField = (key: keyof ConnectorMCPFormState, value: string | MCPType) =>
		setState((current) => ({ ...current, [key]: value }))

	const updateOAuth = (key: keyof OAuthConfig, value: string) =>
		setState((current) => ({
			...current,
			service_config: {
				...current.service_config,
				oauth2_config: { ...current.service_config.oauth2_config, [key]: value },
			},
		}))

	const updateMCPAuthorization = (
		key: keyof Omit<MCPAuthorizationConfig, "additional_params">,
		value: string,
	) =>
		setState((current) => ({
			...current,
			service_config: {
				...current.service_config,
				mcp_authorization_config: {
					...current.service_config.mcp_authorization_config,
					[key]: value,
				},
			},
		}))

	const handleIconChange = async (files: FileList | null) => {
		if (!files?.length) return
		const newFiles = Array.from(files).map(genFileData)
		const { fullfilled } = await uploadAndGetFileUrl(newFiles)
		if (!fullfilled.length) {
			magicToast.error(t("mcp.form.uploadFail"))
			return
		}
		const { url, path: key } = fullfilled[0].value
		setIconPreviewUrl(url)
		setState((current) => ({ ...current, icon: key }))
	}

	const getStateValidationErrors = (candidate: ConnectorMCPFormState) => {
		const nextErrors: Record<string, string> = {}
		if (!candidate.name.trim())
			nextErrors.name = t("mcp.form.required", { name: t("mcp.form.name") })
		if (
			[MCPType.SSE, MCPType.HTTP].includes(candidate.type) &&
			!candidate.service_config.url.trim()
		) {
			nextErrors.url = t("mcp.form.required", {
				name: tMarket("connectors.createForm.url"),
			})
		}
		if (candidate.type === MCPType.STDIO && !candidate.service_config.command.trim()) {
			nextErrors.command = t("mcp.form.required", { name: t("mcp.form.command") })
		}
		if (candidate.type === MCPType.Tool && candidate.tools.length === 0) {
			nextErrors.tools = tMarket("connectors.createForm.importToolsRequired")
		}
		if (candidate.service_config.auth_type === 1) {
			for (const key of [
				"client_id",
				"client_secret",
				"client_url",
				"authorization_url",
				"authorization_content_type",
			] as const) {
				const value =
					key === "authorization_content_type"
						? candidate.authorization_content_type
						: candidate.service_config.oauth2_config[key]
				if (!value.trim())
					nextErrors[key] = tMarket("connectors.createForm.oauthRequired", { name: key })
			}
		}
		if (candidate.service_config.auth_type === 2) {
			const authorizationConfig = candidate.service_config.mcp_authorization_config
			if (
				authorizationConfig.registration_mode === "pre_registered" &&
				!authorizationConfig.client_id.trim()
			) {
				nextErrors.client_id = tMarket("connectors.createForm.oauthRequired", {
					name: "Client ID",
				})
			}
			if (
				authorizationConfig.registration_mode === "cimd" &&
				!authorizationConfig.client_metadata_url.trim()
			) {
				nextErrors.client_metadata_url = tMarket("connectors.createForm.oauthRequired", {
					name: "Client Metadata URL",
				})
			}
			if (
				["client_secret_basic", "client_secret_post"].includes(
					authorizationConfig.token_endpoint_auth_method,
				) &&
				!authorizationConfig.client_secret.trim()
			) {
				nextErrors.client_secret = tMarket("connectors.createForm.oauthRequired", {
					name: "Client Secret",
				})
			}
		}
		return nextErrors
	}

	const currentValidationErrors = getStateValidationErrors(state)
	const hasBlockingFormErrors =
		(state.type === MCPType.Tool || !jsonImportEnabled) &&
		Object.keys(currentValidationErrors).length > 0

	const handleJsonChange = (value: string) => {
		isJsonEditingRef.current = true
		setJsonValue(value)
		try {
			const parsedState = { ...parseJsonValue(value), id: state.id }
			setState(parsedState)
			setErrors({})
			setJsonError("")
		} catch {
			isJsonEditingRef.current = false
			setErrors({})
			// Keep the invalid text visible and make validation block submission
			// instead of silently submitting the previous parsed state.
			setJsonError(t("common.tool.panel.jsonValidationFailed"))
		}
	}

	const validate = (): ConnectorMCPFormState | null => {
		let nextState = state
		if (jsonImportEnabled && state.type !== MCPType.Tool) {
			try {
				nextState = { ...parseJsonValue(jsonValue), id: state.id }
			} catch {
				setJsonError(t("common.tool.panel.jsonValidationFailed"))
				setErrors({})
				return null
			}
			setErrors({})
			setJsonError("")
			return nextState
		}
		const nextErrors = getStateValidationErrors(nextState)
		setErrors(nextErrors)
		if (Object.keys(nextErrors).length > 0) {
			return null
		}
		setJsonError("")
		return nextState
	}

	const handleSubmit = async () => {
		const validatedState = validate()
		if (!validatedState) return
		try {
			const {
				oauth2_config: oauth2Config,
				mcp_authorization_config: mcpAuthorizationConfig,
				...serviceConfig
			} = validatedState.service_config
			const payload = {
				...validatedState,
				name: validatedState.name.trim(),
				service_config: {
					...serviceConfig,
					headers: validatedState.service_config.headers.filter((item) =>
						item.key.trim(),
					),
					env: validatedState.service_config.env.filter((item) => item.key.trim()),
					...(validatedState.service_config.auth_type === 1
						? { oauth2_config: oauth2Config }
						: {}),
					...(validatedState.service_config.auth_type === 2
						? {
								mcp_authorization_config:
									serializeMCPAuthorizationConfig(mcpAuthorizationConfig),
							}
						: {}),
				},
			}
			await saveMcp(payload as unknown as Flow.Mcp.SaveParams)
			onSuccessCallback?.()
			onClose?.()
		} catch (error) {
			if (error instanceof Error) {
				magicToast.error(error.message)
				return
			}

			// API response errors are already displayed by the response interceptor
			// when they contain a backend message. Avoid showing a duplicate fallback toast.
			if (
				error &&
				typeof error === "object" &&
				"message" in error &&
				typeof error.message === "string" &&
				error.message.trim()
			)
				return

			magicToast.error(tMarket("connectors.createForm.saveFailed"))
		}
	}

	return (
		<div
			data-testid="connector-mcp-form-root"
			className="flex w-full min-w-0 flex-col overflow-hidden rounded-xl"
		>
			<div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3">
				<div className="text-base font-semibold text-foreground">
					{tMarket(
						connector
							? "connectors.createForm.editTitle"
							: "connectors.createForm.title",
					)}
				</div>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-8"
					onClick={onClose}
					aria-label={tMarket("connectors.createForm.close")}
				>
					<X className="size-5" />
				</Button>
			</div>
			{loadingInitialData ? (
				<div className="flex h-[min(68vh,680px)] items-center justify-center">
					<Loader2 className="size-5 animate-spin text-muted-foreground" />
				</div>
			) : (
				<ScrollArea
					className="h-[min(68vh,680px)] w-full min-w-0"
					viewportClassName="overflow-x-hidden px-5 py-4 [&>div]:!block [&>div]:!w-full [&>div]:!min-w-0"
				>
					<div className="flex flex-col gap-5 pb-2">
						<div className="flex flex-col gap-4">
							<div className="flex items-center gap-3">
								<div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
									{iconPreviewUrl || state.icon ? (
										<img
											src={iconPreviewUrl || state.icon}
											alt=""
											className="size-full object-cover"
										/>
									) : (
										<IconMCP className="size-full" />
									)}
								</div>
								<div className="flex flex-col gap-1">
									<div className="text-sm font-medium">{t("mcp.form.icon")}</div>
									<div className="text-xs text-muted-foreground">
										{tMarket("connectors.createForm.iconHint")}
									</div>
									<input
										ref={fileInputRef}
										type="file"
										accept="image/*"
										className="hidden"
										onChange={(event) =>
											void handleIconChange(event.target.files)
										}
									/>
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="w-fit gap-1.5"
										disabled={uploading}
										onClick={() => fileInputRef.current?.click()}
									>
										<Upload className="size-4" />
										{uploading
											? tMarket("connectors.createForm.uploading")
											: tMarket("connectors.createForm.uploadIcon")}
									</Button>
								</div>
							</div>
							<div className={fieldClassName}>
								<Label htmlFor="connector-mcp-name">
									{tMarket("connectors.createForm.name")}
									<span className="text-destructive"> *</span>
								</Label>
								<Input
									id="connector-mcp-name"
									value={state.name}
									placeholder={tMarket("connectors.createForm.namePlaceholder")}
									className={inputClassName}
									onChange={(event) =>
										updateField(MCPFormField.Name, event.target.value)
									}
								/>
								{errors.name && (
									<p className="text-xs text-destructive">{errors.name}</p>
								)}
							</div>
							<div className={fieldClassName}>
								<Label htmlFor="connector-mcp-description">
									{t("mcp.form.desc")}
								</Label>
								<Textarea
									id="connector-mcp-description"
									value={state.description}
									placeholder={tMarket(
										"connectors.createForm.descriptionPlaceholder",
									)}
									className="min-h-20 resize-y"
									onChange={(event) =>
										updateField(MCPFormField.Description, event.target.value)
									}
								/>
							</div>
						</div>

						<RadioGroup
							value={state.type === MCPType.Tool ? "tools" : "custom"}
							onValueChange={(value) => {
								const nextType = value === "tools" ? MCPType.Tool : MCPType.SSE
								if (nextType === MCPType.Tool) {
									setJsonError("")
									setErrors({})
								}
								updateField(MCPFormField.MCPType, nextType)
							}}
							className="grid grid-cols-1 gap-3 sm:grid-cols-2"
						>
							<label
								htmlFor="connector-mcp-type-tools"
								className={cn(
									"group order-2 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-4 transition-all hover:border-primary/50 hover:bg-primary/[0.03]",
									state.type === MCPType.Tool &&
										"border-primary bg-primary/[0.04] shadow-sm",
								)}
							>
								<RadioGroupItem
									value="tools"
									id="connector-mcp-type-tools"
									className="mt-0.5"
								/>
								<span className="flex min-w-0 flex-1 flex-col gap-1">
									<span className="text-sm font-semibold text-foreground">
										{t("common.tool.panel.importExistingToolsTitle")}
									</span>
									<span className="text-xs leading-5 text-muted-foreground">
										{t("common.tool.panel.importExistingToolsDesc")}
									</span>
								</span>
							</label>
							<label
								htmlFor="connector-mcp-type-custom"
								className={cn(
									"group order-1 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-4 transition-all hover:border-primary/50 hover:bg-primary/[0.03]",
									state.type !== MCPType.Tool &&
										"border-primary bg-primary/[0.04] shadow-sm",
								)}
							>
								<RadioGroupItem
									value="custom"
									id="connector-mcp-type-custom"
									className="mt-0.5"
								/>
								<span className="flex min-w-0 flex-1 flex-col gap-1">
									<span className="text-sm font-semibold text-foreground">
										{t("common.tool.panel.customMcpTitle")}
									</span>
									<span className="text-xs leading-5 text-muted-foreground">
										{t("common.tool.panel.customMcpDesc")}
									</span>
								</span>
							</label>
						</RadioGroup>

						{state.type === MCPType.Tool ? (
							<div className="flex flex-col gap-3 rounded-xl bg-muted/60 p-4">
								<div className="flex items-center justify-between gap-2">
									<div>
										<div className="text-sm font-medium">
											{t("common.tool.card.groupTitle", {
												count: state.tools.length,
											})}
										</div>
										<div className="text-xs text-muted-foreground">
											{t("common.tool.panel.importExistingToolsDesc")}
										</div>
									</div>
									<Button
										type="button"
										className="gap-1.5"
										onClick={() => setToolDialogOpen(true)}
									>
										<Plus className="size-4" />
										{t("common.tool.importExistingTools")}
									</Button>
								</div>
								{state.tools.length ? (
									<div className="flex flex-col gap-2">
										{state.tools.map((tool) => (
											<div
												key={tool.rel_code}
												className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2"
											>
												<div className="min-w-0">
													<div className="truncate text-sm font-medium">
														{tool.name}
													</div>
													<div className="truncate text-xs text-muted-foreground">
														{tool.description}
													</div>
												</div>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="size-8 text-muted-foreground hover:text-destructive"
													onClick={() =>
														setState((current) => ({
															...current,
															tools: current.tools.filter(
																(item) =>
																	item.rel_code !== tool.rel_code,
															),
														}))
													}
												>
													<Trash2 className="size-4" />
												</Button>
											</div>
										))}
									</div>
								) : (
									<div className="rounded-xl bg-white px-3 py-6 text-center text-sm text-muted-foreground">
										{t("common.tool.panel.emptyState")}
									</div>
								)}
								{errors.tools && (
									<p className="text-xs text-destructive">{errors.tools}</p>
								)}
							</div>
						) : (
							<>
								<div className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 p-3">
									<div className="text-sm font-medium">
										{t("common.tool.panel.importViaJson")}
									</div>
									<Switch
										checked={jsonImportEnabled}
										onCheckedChange={setJsonImportEnabled}
									/>
								</div>
								{jsonImportEnabled ? (
									<div className="flex flex-col gap-2">
										<div className="overflow-hidden rounded-xl border border-[#34363f] bg-[#1c1d23]">
											<Editor
												value={jsonValue}
												onValueChange={handleJsonChange}
												highlight={(code: string) => (
													<span
														dangerouslySetInnerHTML={{
															__html: highlightJsonCode(code),
														}}
													/>
												)}
												padding={14}
												style={{
													fontFamily:
														"'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
													fontSize: 12,
													lineHeight: 1.6,
													backgroundColor: "#1c1d23",
													color: "#d4d4d4",
													minHeight: 144,
												}}
												textareaClassName="!resize-none !border-none !bg-transparent !outline-none !pointer-events-auto !select-text"
												preClassName="!m-0"
											/>
											<div className="border-t border-[#34363f] bg-[#1c1d23] px-3 py-2">
												<div
													className={cn(
														"text-xs leading-5",
														jsonError
															? "text-destructive"
															: "text-[#a1a1aa]",
													)}
												>
													{jsonError ||
														t("common.tool.panel.jsonValidationPassed")}
												</div>
											</div>
										</div>
									</div>
								) : null}
								{!jsonImportEnabled ? (
									<>
										<div className={fieldClassName}>
											<Label>{tMarket("connectors.createForm.type")}</Label>
											<Select
												value={state.type}
												onValueChange={(value) =>
													updateField(
														MCPFormField.MCPType,
														value as MCPType,
													)
												}
											>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent
													style={
														nestedLayerZIndex
															? { zIndex: nestedLayerZIndex }
															: undefined
													}
												>
													<SelectItem value={MCPType.HTTP}>
														{t("mcp.form.options.http")}
													</SelectItem>
													<SelectItem value={MCPType.SSE}>
														{t("mcp.form.options.sse")}
													</SelectItem>
													<SelectItem value={MCPType.STDIO}>
														{t("mcp.form.options.stdio")}
													</SelectItem>
												</SelectContent>
											</Select>
										</div>
										<div className={fieldClassName}>
											<Label>
												{state.type === MCPType.STDIO
													? t("mcp.form.command")
													: tMarket("connectors.createForm.url")}
											</Label>
											<Input
												value={
													state.type === MCPType.STDIO
														? state.service_config.command
														: state.service_config.url
												}
												placeholder={
													state.type === MCPType.STDIO
														? undefined
														: tMarket(
																"connectors.createForm.urlPlaceholder",
															)
												}
												className={inputClassName}
												onChange={(event) =>
													updateNestedState(
														setState,
														state.type === MCPType.STDIO
															? MCPFormField.Command
															: MCPFormField.Url,
														event.target.value,
													)
												}
											/>
											{errors[
												state.type === MCPType.STDIO ? "command" : "url"
											] && (
												<p className="text-xs text-destructive">
													{
														errors[
															state.type === MCPType.STDIO
																? "command"
																: "url"
														]
													}
												</p>
											)}
										</div>
										{state.type === MCPType.STDIO ? (
											<>
												<div className={fieldClassName}>
													<Label>{t("mcp.form.args")}</Label>
													<Input
														value={state.service_config.arguments}
														className={inputClassName}
														onChange={(event) =>
															updateNestedState(
																setState,
																MCPFormField.Arguments,
																event.target.value,
															)
														}
													/>
												</div>
											</>
										) : null}
									</>
								) : null}
								<div className="flex flex-col gap-2">
									<Label>
										{state.type === MCPType.STDIO
											? tMarket("connectors.createForm.env")
											: tMarket("connectors.createForm.headersLabel")}
									</Label>
									<KeyValueEditor
										rows={
											state.type === MCPType.STDIO
												? state.service_config.env
												: state.service_config.headers
										}
										onChange={(rows) =>
											updateNestedState(
												setState,
												state.type === MCPType.STDIO
													? MCPFormField.Env
													: MCPFormField.Header,
												rows,
											)
										}
										placeholder={t("mcp.form.value")}
										keyLabel={tMarket("connectors.createForm.key")}
										removeLabel={tMarket("connectors.createForm.removeRow")}
										addLabel={tMarket("connectors.createForm.addParameter")}
									/>
								</div>
								{[MCPType.SSE, MCPType.HTTP].includes(state.type) ? (
									<>
										<div className={fieldClassName}>
											<Label>{t("mcp.form.authMethod")}</Label>
											<Select
												value={String(state.service_config.auth_type)}
												onValueChange={(value) =>
													updateNestedState(
														setState,
														MCPFormField.AuthType,
														Number(value),
													)
												}
											>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent
													style={
														nestedLayerZIndex
															? { zIndex: nestedLayerZIndex }
															: undefined
													}
												>
													<SelectItem value="0">
														{t("mcp.form.noAuth")}
													</SelectItem>
													<SelectItem value="1">OAuth 2.0</SelectItem>
													<SelectItem value="2">
														{tMarket(
															"connectors.createForm.mcpAuthorization",
														)}
													</SelectItem>
												</SelectContent>
											</Select>
										</div>
										{state.service_config.auth_type === 1 ? (
											<div className="rounded-xl bg-muted/60 p-4">
												<div className="grid grid-cols-1 gap-3">
													{(
														[
															"client_id",
															"client_secret",
															"client_url",
															"scope",
															"authorization_url",
															"authorization_method",
															"authorization_content_type",
														] as const
													).map((key) => (
														<div className={fieldClassName} key={key}>
															<Label>
																{tMarket(
																	`connectors.createForm.oauthLabels.${oauthLabelKeys[key]}`,
																)}
																{key !== "scope" &&
																	key !==
																		"authorization_method" && (
																		<span className="text-destructive">
																			{" "}
																			*
																		</span>
																	)}
															</Label>
															{key === "authorization_method" ? (
																<Select
																	value={
																		state.service_config
																			.oauth2_config
																			.authorization_method
																	}
																	onValueChange={(value) =>
																		updateOAuth(
																			"authorization_method",
																			value,
																		)
																	}
																>
																	<SelectTrigger
																		className={inputClassName}
																	>
																		<SelectValue />
																	</SelectTrigger>
																	<SelectContent
																		style={
																			nestedLayerZIndex
																				? {
																						zIndex: nestedLayerZIndex,
																					}
																				: undefined
																		}
																	>
																		<SelectItem value="POST">
																			POST
																		</SelectItem>
																		<SelectItem value="GET">
																			GET
																		</SelectItem>
																	</SelectContent>
																</Select>
															) : (
																<Input
																	value={
																		key ===
																		"authorization_content_type"
																			? state.authorization_content_type
																			: state.service_config
																					.oauth2_config[
																					key as keyof OAuthConfig
																				]
																	}
																	className={inputClassName}
																	onChange={(event) =>
																		key ===
																		"authorization_content_type"
																			? setState(
																					(current) => ({
																						...current,
																						authorization_content_type:
																							event
																								.target
																								.value,
																					}),
																				)
																			: updateOAuth(
																					key as keyof OAuthConfig,
																					event.target
																						.value,
																				)
																	}
																/>
															)}
															{errors[key] && (
																<p className="text-xs text-destructive">
																	{errors[key]}
																</p>
															)}
														</div>
													))}
												</div>
											</div>
										) : null}
										{state.service_config.auth_type === 2 ? (
											<div className="rounded-xl bg-muted/60 p-4">
												<div className="grid grid-cols-1 gap-3">
													<div className={fieldClassName}>
														<Label>
															{tMarket(
																`connectors.createForm.mcpAuthorizationLabels.${mcpAuthorizationLabelKeys.registration_mode}`,
															)}
														</Label>
														<Select
															value={
																state.service_config
																	.mcp_authorization_config
																	.registration_mode
															}
															onValueChange={(value) =>
																updateMCPAuthorization(
																	"registration_mode",
																	value,
																)
															}
														>
															<SelectTrigger>
																<SelectValue />
															</SelectTrigger>
															<SelectContent
																style={
																	nestedLayerZIndex
																		? {
																				zIndex: nestedLayerZIndex,
																			}
																		: undefined
																}
															>
																{[
																	"auto",
																	"pre_registered",
																	"cimd",
																	"dcr",
																].map((value) => (
																	<SelectItem
																		key={value}
																		value={value}
																	>
																		{tMarket(
																			`connectors.createForm.registrationModes.${value}`,
																		)}
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
													</div>
													{state.service_config.mcp_authorization_config
														.registration_mode !== "auto" ? (
														<>
															{(
																[
																	"resource",
																	"resource_metadata_url",
																	"authorization_server_url",
																	"authorization_endpoint",
																	"token_endpoint",
																	"registration_endpoint",
																] as const
															).map((key) => (
																<div
																	className={fieldClassName}
																	key={key}
																>
																	<Label>
																		{tMarket(
																			`connectors.createForm.mcpAuthorizationLabels.${mcpAuthorizationLabelKeys[key]}`,
																		)}
																	</Label>
																	<Input
																		value={
																			state.service_config
																				.mcp_authorization_config[
																				key
																			]
																		}
																		className={inputClassName}
																		onChange={(event) =>
																			updateMCPAuthorization(
																				key,
																				event.target.value,
																			)
																		}
																	/>
																	{errors[key] && (
																		<p className="text-xs text-destructive">
																			{errors[key]}
																		</p>
																	)}
																</div>
															))}

															{(
																[
																	"client_id",
																	"client_secret",
																	"client_metadata_url",
																] as const
															).map((key) => (
																<div
																	className={fieldClassName}
																	key={key}
																>
																	<Label>
																		{tMarket(
																			`connectors.createForm.mcpAuthorizationLabels.${mcpAuthorizationLabelKeys[key]}`,
																		)}
																		{(key === "client_id" &&
																			state.service_config
																				.mcp_authorization_config
																				.registration_mode ===
																				"pre_registered") ||
																		(key ===
																			"client_metadata_url" &&
																			state.service_config
																				.mcp_authorization_config
																				.registration_mode ===
																				"cimd") ? (
																			<span className="text-destructive">
																				{" "}
																				*
																			</span>
																		) : null}
																	</Label>
																	<Input
																		type={
																			key === "client_secret"
																				? "password"
																				: key ===
																					  "client_metadata_url"
																					? "url"
																					: "text"
																		}
																		value={
																			state.service_config
																				.mcp_authorization_config[
																				key
																			]
																		}
																		className={inputClassName}
																		onChange={(event) =>
																			updateMCPAuthorization(
																				key,
																				event.target.value,
																			)
																		}
																	/>
																	{errors[key] && (
																		<p className="text-xs text-destructive">
																			{errors[key]}
																		</p>
																	)}
																</div>
															))}

															<div className={fieldClassName}>
																<Label>
																	{tMarket(
																		`connectors.createForm.mcpAuthorizationLabels.${mcpAuthorizationLabelKeys.token_endpoint_auth_method}`,
																	)}
																</Label>
																<Select
																	value={
																		state.service_config
																			.mcp_authorization_config
																			.token_endpoint_auth_method ||
																		"none"
																	}
																	onValueChange={(value) =>
																		updateMCPAuthorization(
																			"token_endpoint_auth_method",
																			value === "none"
																				? ""
																				: value,
																		)
																	}
																>
																	<SelectTrigger>
																		<SelectValue />
																	</SelectTrigger>
																	<SelectContent
																		style={
																			nestedLayerZIndex
																				? {
																						zIndex: nestedLayerZIndex,
																					}
																				: undefined
																		}
																	>
																		<SelectItem value="none">
																			none
																		</SelectItem>
																		<SelectItem value="client_secret_basic">
																			client_secret_basic
																		</SelectItem>
																		<SelectItem value="client_secret_post">
																			client_secret_post
																		</SelectItem>
																	</SelectContent>
																</Select>
															</div>

															<div className={fieldClassName}>
																<Label>
																	{tMarket(
																		`connectors.createForm.mcpAuthorizationLabels.${mcpAuthorizationLabelKeys.application_type}`,
																	)}
																</Label>
																<Select
																	value={
																		state.service_config
																			.mcp_authorization_config
																			.application_type
																	}
																	onValueChange={(value) =>
																		updateMCPAuthorization(
																			"application_type",
																			value,
																		)
																	}
																>
																	<SelectTrigger>
																		<SelectValue />
																	</SelectTrigger>
																	<SelectContent
																		style={
																			nestedLayerZIndex
																				? {
																						zIndex: nestedLayerZIndex,
																					}
																				: undefined
																		}
																	>
																		<SelectItem value="native">
																			native
																		</SelectItem>
																		<SelectItem value="web">
																			web
																		</SelectItem>
																	</SelectContent>
																</Select>
															</div>

															<div className={fieldClassName}>
																<Label>
																	{tMarket(
																		`connectors.createForm.mcpAuthorizationLabels.${mcpAuthorizationLabelKeys.scope}`,
																	)}
																</Label>
																<Input
																	value={
																		state.service_config
																			.mcp_authorization_config
																			.scope
																	}
																	className={inputClassName}
																	onChange={(event) =>
																		updateMCPAuthorization(
																			"scope",
																			event.target.value,
																		)
																	}
																/>
															</div>

															<div className="flex flex-col gap-2">
																<Label>
																	{tMarket(
																		`connectors.createForm.mcpAuthorizationLabels.${mcpAuthorizationLabelKeys.additional_params}`,
																	)}
																</Label>
																<KeyValueEditor
																	rows={
																		state.service_config
																			.mcp_authorization_config
																			.additional_params
																	}
																	onChange={(rows) =>
																		setState((current) => ({
																			...current,
																			service_config: {
																				...current.service_config,
																				mcp_authorization_config:
																					{
																						...current
																							.service_config
																							.mcp_authorization_config,
																						additional_params:
																							rows,
																					},
																			},
																		}))
																	}
																	placeholder={t(
																		"mcp.form.value",
																	)}
																	keyLabel={tMarket(
																		"connectors.createForm.key",
																	)}
																	removeLabel={tMarket(
																		"connectors.createForm.removeRow",
																	)}
																	addLabel={tMarket(
																		"connectors.createForm.addParameter",
																	)}
																/>
															</div>
														</>
													) : null}
												</div>
											</div>
										) : null}
									</>
								) : null}
							</>
						)}
					</div>
				</ScrollArea>
			)}
			<Separator />
			<div className="flex shrink-0 justify-end gap-2 px-5 py-3">
				<Button type="button" variant="outline" onClick={onClose}>
					{t("common.tool.form.cancel")}
				</Button>
				<Button
					type="button"
					disabled={
						saving ||
						hasBlockingFormErrors ||
						(state.type !== MCPType.Tool && jsonImportEnabled && Boolean(jsonError))
					}
					onClick={() => void handleSubmit()}
				>
					{saving
						? tMarket("connectors.createForm.saving")
						: t("common.tool.form.create")}
				</Button>
			</div>
			<ToolImportDialog
				open={toolDialogOpen}
				onOpenChange={setToolDialogOpen}
				zIndex={nestedLayerZIndex}
				selectedTools={state.tools}
				onToggle={(tool, toolsetId, selected) =>
					setState((current) => ({
						...current,
						tools: selected
							? current.tools.filter((item) => item.rel_code !== tool.code)
							: [
									...current.tools,
									{
										...tool,
										rel_code: tool.code,
										source: 1,
										rel_info: { tool_set_id: toolsetId },
										enabled: true,
									} as unknown as Flow.Mcp.ListItem,
								],
					}))
				}
			/>
		</div>
	)
}

import { Button as AntButton, Form, Input } from "antd"
import { IconX } from "@tabler/icons-react"
import { Link, X } from "lucide-react"
import { IconMCP } from "@/enhance/tabler/icons-react"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { cn } from "@/utils/cn"
import MagicSpin from "@/components/base/MagicSpin"
import { Button } from "@/components/shadcn-ui/button"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { AgentCommonModalChildrenProps } from "../../AgentCommonModal"
import { useMemoizedFn, useRequest, useThrottleEffect } from "ahooks"
import { FlowApi } from "@/apis"
import { MCPOAuthService } from "../service/MCPOAuthService"
import type { MCPOAuthStatus } from "../service/MCPOAuthService"
import { generateCallbackUrl } from "../helpers"
import { renderMarkdownLinks } from "../renderMarkdownLinks"
import { trim, isString } from "lodash-es"
import MagicImage from "@/components/base/MagicImage"
import magicToast from "@/components/base/MagicToaster/utils"
import { useTranslation } from "react-i18next"
import type { GetAvailableMCPListResponse } from "@/types/flow"

interface MCPEditor extends AgentCommonModalChildrenProps {
	id: string
	onEnable?: ((id: string) => Promise<void>) | ((id: string) => void)
	onAuthRevoked?: () => void
	panelVariant?: "default" | "connector-market"
	panelMode?: "add" | "edit"
	initialUserSettings?: MCPOAuthStatus
	initialMcpDetails?: GetAvailableMCPListResponse
}

const authSectionClassName =
	"flex cursor-pointer items-center justify-center self-stretch rounded-[8px] bg-fill px-6 py-1.5 text-sm font-semibold not-italic leading-5 text-foreground/80 dark:bg-white/10"

const connectorAuthSectionClassName =
	"cursor-default flex-col gap-2 border border-border bg-[linear-gradient(120deg,#fdfbfb_0%,#ebedee_100%)] px-7 py-6 text-center font-normal leading-6 shadow-none transition-colors duration-200 ease-[ease] dark:bg-none"

const activeAuthSectionClassName =
	"bg-primary/[0.08] text-primary hover:bg-primary/[0.12] active:bg-primary/[0.16] dark:bg-primary/20 dark:hover:bg-primary/[0.28] dark:active:bg-primary/[0.36]"

function getSafeAuthorizationUrl(value: unknown) {
	if (typeof value !== "string" || !value.trim()) return null

	try {
		const url = new URL(value.trim())
		if (url.protocol !== "https:" || url.username || url.password) return null
		return url.toString()
	} catch {
		return null
	}
}

export default function MCPOAuth(props: MCPEditor) {
	const {
		id,
		onClose,
		onEnable,
		onAuthRevoked,
		panelVariant = "default",
		panelMode = "add",
		initialUserSettings,
		initialMcpDetails,
	} = props

	const [form] = Form.useForm()
	const { t } = useTranslation("agent")
	const { t: tMarket } = useTranslation("crew/market")
	const service = useRef<MCPOAuthService>(new MCPOAuthService(FlowApi))

	/** Authorization state reported by the OAuth status request or polling service. */
	const [isAuth, setAuth] = useState(false)
	const [authVisible, setAuthVisible] = useState(false)
	const [isFinishFillForm, setFinishFillForm] = useState(false)
	const [isAutoAdded, setIsAutoAdded] = useState(false)
	const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
	const [hasExpandableDescription, setHasExpandableDescription] = useState(false)
	const descriptionRef = useRef<HTMLParagraphElement>(null)
	const isAutoAddingRef = useRef(false)

	const {
		data: fetchedUserSettings,
		loading: getMCPUserSettingsLoading,
		refresh,
	} = useRequest(
		() => FlowApi.getMCPUserSettings({ code: id, redirectUrl: generateCallbackUrl() }),
		{
			manual: Boolean(initialUserSettings),
			onSuccess(data) {
				setAuth(data?.auth_config?.is_authenticated)
				setAuthVisible(data?.auth_type === 1 || data?.auth_type === 2)
			},
		},
	)
	const data = fetchedUserSettings ?? initialUserSettings

	useEffect(() => {
		if (!initialUserSettings) return
		setAuth(initialUserSettings.auth_config?.is_authenticated)
		setAuthVisible(initialUserSettings.auth_type === 1 || initialUserSettings.auth_type === 2)
	}, [initialUserSettings])

	const { data: fetchedMcpDetails, loading: getAvailableMCPLoading } = useRequest(
		() => FlowApi.getAvailableMCP([id]),
		{
			manual: Boolean(initialMcpDetails),
		},
	)
	const mcpDetails = initialMcpDetails ?? fetchedMcpDetails

	useThrottleEffect(
		() => {
			const details = mcpDetails?.list?.[0]
			if (details && data) {
				// Skip field validation when no setup fields are required.
				if (details.require_fields.length === 0) {
					setFinishFillForm(true)
				} else {
					const fieldNames = details.require_fields.map((i) => i.field_name)

					const formData = data.require_fields.reduce<Record<string, unknown>>(
						(res, item) => {
							res[item.field_name] = item.field_value
							return res
						},
						{},
					)
					form.setFieldsValue(formData)
					setFinishFillForm(
						fieldNames.every(
							(i) => isString(formData?.[i]) && trim(formData?.[i]) !== "",
						),
					)
				}
			}
		},
		[mcpDetails, data],
		{ wait: 500, leading: false },
	)

	const saveRequiredFields = useMemoizedFn(async () => {
		const values = form.getFieldsValue()
		const formData = Object.keys(values).map((key) => ({
			field_name: key,
			field_value: values?.[key],
		}))
		if (formData.length > 0) {
			await FlowApi.saveMCPRequireFields(id, {
				require_fields: formData,
			})
		}
	})

	const onSubmit = useMemoizedFn(async () => {
		await saveRequiredFields()
		await onEnable?.(id)
		onClose?.()
	})

	const autoAddAuthorizedConnector = useMemoizedFn(async () => {
		if (isAutoAdded || isAutoAddingRef.current) return
		isAutoAddingRef.current = true
		try {
			await saveRequiredFields()
			await onEnable?.(id)
			setIsAutoAdded(true)
		} catch (error) {
			isAutoAddingRef.current = false
			console.error(error)
		}
	})

	const triggerStartPolling = useMemoizedFn(() => {
		const authorizationUrl =
			data?.auth_config?.authorization_url || data?.auth_config?.oauth_url
		const safeAuthorizationUrl = getSafeAuthorizationUrl(authorizationUrl)
		if (!safeAuthorizationUrl) {
			magicToast.error(t("mcp.form.authorizationUrlInvalid"))
			return
		}

		window.open(safeAuthorizationUrl, "_blank", "noopener,noreferrer")
		// Poll the callback status after opening authorization in a separate window.
		service.current?.restart(id, data)
	})

	const triggerUnbind = useMemoizedFn(async () => {
		await FlowApi.unBindMCPOAuth(id)
		setAuth(false)
		setIsAutoAdded(false)
		isAutoAddingRef.current = false
		onAuthRevoked?.()
		refresh()
	})

	/** Update setup completeness as the user edits required fields. */
	const onValuesChange = useMemoizedFn((_changedValues, values) => {
		// Every required field must contain a non-empty string before submission.
		if (mcpDetails?.list?.[0]?.require_fields) {
			const result = mcpDetails?.list?.[0]?.require_fields.every((fieldItem) => {
				const fieldValue = values?.[fieldItem?.field_name]
				return isString(fieldValue) && trim(fieldValue) !== ""
			})
			setFinishFillForm(result)
		}
	})

	useThrottleEffect(
		() => {
			service.current?.setCallbacks({
				// Reflect successful authorization without repeating the authorization request.
				onSuccess() {
					setAuth(true)
				},
			})

			const currentService = service.current
			return () => {
				currentService?.destroy?.()
			}
		},
		[],
		{ wait: 500, leading: false },
	)

	useEffect(() => {
		if (
			panelVariant !== "connector-market" ||
			!authVisible ||
			!isAuth ||
			!isFinishFillForm ||
			isAutoAdded
		)
			return

		void autoAddAuthorizedConnector()
	}, [
		authVisible,
		autoAddAuthorizedConnector,
		isAuth,
		isAutoAdded,
		isFinishFillForm,
		panelVariant,
	])

	const mcpInfo = mcpDetails?.list?.[0]
	const requiredFields = mcpInfo?.require_fields ?? []
	const hasSetupFields = Boolean(requiredFields.length || authVisible)
	const connectorDescription = mcpInfo?.description || t("mcp.card.desc")

	useEffect(() => {
		setIsDescriptionExpanded(false)
		setHasExpandableDescription(false)
	}, [connectorDescription])

	useLayoutEffect(() => {
		if (
			panelVariant !== "connector-market" ||
			!descriptionRef.current ||
			isDescriptionExpanded
		) {
			return
		}

		let frameId = 0
		const measureDescription = () => {
			const descriptionElement = descriptionRef.current
			if (!descriptionElement) return

			setHasExpandableDescription(
				descriptionElement.scrollHeight > descriptionElement.clientHeight + 1,
			)
		}

		frameId = window.requestAnimationFrame(measureDescription)
		return () => window.cancelAnimationFrame(frameId)
	}, [connectorDescription, isDescriptionExpanded, panelVariant])

	const authForm = (
		<Form form={form} layout="vertical" onValuesChange={onValuesChange}>
			{requiredFields.length > 0 ? (
				<>
					{requiredFields.map((item) => (
						<Form.Item
							key={item.field_name}
							label={item.field_name}
							name={item.field_name}
							className="mb-2.5"
							required
							rules={[
								{
									required: true,
									message: t("mcp.form.required", {
										name: item.field_name,
									}),
								},
							]}
						>
							<Input />
						</Form.Item>
					))}
				</>
			) : null}
			{authVisible ? (
				<Form.Item label={t("mcp.form.auth")} className="mb-2.5">
					{isAuth ? (
						<div
							onClick={
								panelVariant === "connector-market" ? undefined : triggerUnbind
							}
							className={cn(
								authSectionClassName,
								panelVariant === "connector-market" &&
									connectorAuthSectionClassName,
								panelVariant === "connector-market" &&
									"bg-[linear-gradient(120deg,#f8fbff_0%,#eaf3ff_100%)]",
							)}
						>
							{panelVariant === "connector-market" ? (
								<div className="flex size-[38px] shrink-0 items-center justify-center rounded-lg bg-white shadow-[0_2px_8px_rgba(24,25,29,0.12)] dark:text-neutral-900">
									<Link className="size-6 shrink-0" aria-hidden />
								</div>
							) : null}
							{panelVariant === "connector-market" ? (
								<>
									<span>{t("mcp.form.authToSuccessTitle")}</span>
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="h-8 px-4 font-normal"
										onClick={triggerUnbind}
									>
										{t("mcp.form.authToSuccessAction")}
									</Button>
								</>
							) : (
								t("mcp.form.authToSuccess")
							)}
						</div>
					) : (
						<div
							onClick={
								panelVariant === "connector-market"
									? undefined
									: triggerStartPolling
							}
							className={cn(
								authSectionClassName,
								activeAuthSectionClassName,
								panelVariant === "connector-market" &&
									connectorAuthSectionClassName,
							)}
						>
							{panelVariant === "connector-market" ? (
								<div className="flex size-[38px] shrink-0 items-center justify-center rounded-lg bg-white shadow-[0_2px_8px_rgba(24,25,29,0.12)] dark:text-neutral-900">
									<Link className="size-6 shrink-0" aria-hidden />
								</div>
							) : null}
							{panelVariant === "connector-market" ? (
								<>
									<span>{t("mcp.form.authToFailTitle")}</span>
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="h-8 px-4 font-normal"
										onClick={triggerStartPolling}
									>
										{t("mcp.form.authToFailAction")}
									</Button>
								</>
							) : (
								t("mcp.form.authToFail")
							)}
						</div>
					)}
				</Form.Item>
			) : null}
		</Form>
	)

	if (panelVariant === "connector-market") {
		return (
			<div className="flex min-h-0 min-w-0 flex-col px-3 pb-3 pt-2">
				<div className="relative flex h-7 items-center justify-end pb-1">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="absolute right-0 top-0 size-7 rounded-md text-muted-foreground"
						onClick={onClose}
						data-testid="connector-auth-close-button"
					>
						<X className="size-4" aria-hidden />
					</Button>
				</div>

				<MagicSpin spinning={getMCPUserSettingsLoading || getAvailableMCPLoading}>
					<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 px-1 pb-1">
						<div className="flex min-w-0 items-start gap-3 px-3 pt-0">
							<MagicImage
								className="size-[50px] shrink-0 rounded-xl"
								src={mcpInfo?.icon}
								alt={mcpInfo?.name}
								fallback={
									<div className="size-[50px] shrink-0 overflow-hidden rounded-xl">
										<IconMCP size="100%" />
									</div>
								}
							/>
							<div className="flex min-w-0 flex-1 flex-col gap-2">
								<h2 className="truncate text-[16px] font-semibold leading-[22px] text-foreground">
									{mcpInfo?.name}
								</h2>
								<p
									ref={descriptionRef}
									className={`${isDescriptionExpanded ? "" : "line-clamp-3"} break-words text-[12px] leading-4 text-muted-foreground`}
								>
									{renderMarkdownLinks(connectorDescription, {
										linkClassName:
											"text-primary underline underline-offset-2 hover:opacity-90",
										linkTestId: "connector-auth-description-link",
									})}
								</p>
								{hasExpandableDescription ? (
									<button
										type="button"
										className="mt-0.5 self-start text-[12px] leading-4 text-primary hover:opacity-80"
										onClick={() =>
											setIsDescriptionExpanded((expanded) => !expanded)
										}
										aria-expanded={isDescriptionExpanded}
										data-testid="connector-auth-description-toggle"
									>
										{isDescriptionExpanded
											? tMarket("connectors.collapseDescription")
											: tMarket("connectors.expandDescription")}
									</button>
								) : null}
							</div>
						</div>
						<div
							className="my-2 h-px w-full bg-border"
							data-testid="connector-auth-divider"
						/>

						<div className="flex min-h-0 flex-1 flex-col gap-3">
							{hasSetupFields ? (
								<ScrollArea
									type="always"
									className="w-full"
									viewportClassName="max-h-[min(36vh,18rem)] pl-1 pr-3 [&>div]:!block"
								>
									{authForm}
								</ScrollArea>
							) : null}

							<div className="flex items-center justify-end gap-2">
								<Button
									type="button"
									variant="outline"
									className="h-10"
									onClick={onClose}
									data-testid="connector-auth-cancel-button"
								>
									{t("mcp.form.cancel")}
								</Button>
								{!authVisible ? (
									<Button
										type="button"
										className="h-10 shadow-xs"
										onClick={() => void onSubmit()}
										disabled={!isFinishFillForm}
										data-testid="connector-auth-submit-button"
									>
										{panelMode === "edit"
											? tMarket("connectors.saveConfig")
											: tMarket("connectors.saveAndAdd")}
									</Button>
								) : null}
							</div>
						</div>
					</div>
				</MagicSpin>
			</div>
		)
	}

	return (
		<div className="w-full overflow-hidden rounded-[12px]">
			<div className="flex h-20 w-full items-center justify-between p-5 text-lg font-semibold not-italic leading-6 text-foreground/80">
				<div className="flex min-w-0 items-center gap-2.5">
					<div className="size-10 flex-none overflow-hidden rounded-[8px]">
						<MagicImage
							className="size-10 flex-none overflow-hidden rounded-[8px]"
							src={mcpInfo?.icon}
							alt={mcpInfo?.name}
							fallback={
								<div className="size-10 flex-none overflow-hidden rounded-[8px]">
									<IconMCP size="100%" />
								</div>
							}
						/>
					</div>
					<div className="flex min-w-0 flex-col">
						<span className="line-clamp-1 self-stretch text-sm font-semibold not-italic leading-5 text-foreground/80">
							{mcpInfo?.name}
						</span>
						<span className="line-clamp-2 self-stretch text-ellipsis text-xs font-normal not-italic leading-4 text-foreground/60">
							{renderMarkdownLinks(mcpInfo?.description || t("mcp.card.desc"), {
								linkClassName:
									"text-primary underline underline-offset-2 hover:opacity-90",
								linkTestId: "agent-mcp-oauth-description-link",
							})}
						</span>
					</div>
				</div>
				<div
					className="flex size-6 cursor-pointer items-center justify-center rounded-[6px] transition-all duration-100 ease-linear hover:bg-fill active:bg-fill-secondary dark:hover:bg-white/10 dark:active:bg-white/[0.15]"
					onClick={onClose}
				>
					<IconX size={24} />
				</div>
			</div>
			<MagicSpin spinning={getMCPUserSettingsLoading || getAvailableMCPLoading}>
				<div className="flex flex-col gap-5 pb-5">
					<div className="min-h-20 w-full">
						{/* Keep setup fields scrollable while the action row remains outside the viewport. */}
						<ScrollArea
							type="always"
							className="w-full rounded-[6px]"
							viewportClassName="max-h-[60vh] px-5 [&>div]:!block"
						>
							{authForm}
						</ScrollArea>
					</div>
					<div className="flex w-full items-center justify-end gap-2.5 px-5">
						<AntButton
							className="dark:!border-border dark:!bg-fill dark:!text-foreground/80 dark:hover:!bg-fill-secondary"
							onClick={onClose}
						>
							{t("mcp.form.cancel")}
						</AntButton>
						<AntButton
							type="primary"
							className="dark:enabled:!bg-primary dark:enabled:!text-primary-foreground dark:enabled:hover:!bg-primary/90"
							onClick={onSubmit}
							disabled={!(isFinishFillForm && (authVisible ? isAuth : true))}
						>
							{t("mcp.form.confirm")}
						</AntButton>
					</div>
				</div>
			</MagicSpin>
		</div>
	)
}

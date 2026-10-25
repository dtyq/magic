import { FlowApi } from "@/apis"
import { generateCallbackUrl } from "@/components/Agent/MCP/helpers"
import { openAgentCommonModal } from "@/components/Agent/AgentCommonModal"
import AppearanceProvider from "@/providers/AppearanceProvider"
import { Dialog, DialogContent } from "@/components/shadcn-ui/dialog"
import { cn } from "@/utils/cn"
import { createRoot, type Root } from "react-dom/client"
import { useState } from "react"
import MCPOAuth from "../../../MCPOAuth"
import type { MCPOAuthStatus } from "../../../service/MCPOAuthService"
import type { GetAvailableMCPListResponse } from "@/types/flow"

export const enum MCPOAuthType {
	/** Verification successful */
	successful,
	/** No verification required */
	noVerificationRequired,
	/** Verification failed */
	validationFailed,
}

export interface ConnectorAuthData {
	userSettings: MCPOAuthStatus
	mcpDetails: GetAvailableMCPListResponse
	requiresAuth: boolean
}

export async function fetchConnectorAuthData(item: {
	id: string
	require_fields?: { field_name?: string; field_value?: string }[]
}): Promise<ConnectorAuthData> {
	const mcpDetails = await FlowApi.getAvailableMCP([item.id])
	const userSettings = await FlowApi.getMCPUserSettings({
		code: item.id,
		redirectUrl: generateCallbackUrl(),
	})
	const detailsRequireFields = mcpDetails?.list?.[0]?.require_fields?.length ?? 0

	return {
		userSettings,
		mcpDetails,
		requiresAuth: Boolean(
			userSettings?.auth_type || detailsRequireFields || item.require_fields?.length,
		),
	}
}

interface CheckMCPOAuthOptions {
	/** Optional layer used when the auth form is opened from another dialog. */
	zIndex?: number
	onOpen?: () => void
	onClose?: () => void
	modalClassName?: string
	modalWidth?: number | string
	panelVariant?: "default" | "connector-market"
	panelMode?: "add" | "edit"
	initialUserSettings?: MCPOAuthStatus
}

/**
 * @description Check MCP status
 * @param {IMCPItem} item
 */
export function checkMCPOAuth(
	item: {
		id: string
		require_fields?: { field_name?: string; field_value?: string }[]
	},
	options: CheckMCPOAuthOptions = {},
): Promise<MCPOAuthType> {
	const availableMcpPromise =
		options.panelVariant === "connector-market"
			? FlowApi.getAvailableMCP([item.id])
			: Promise.resolve<GetAvailableMCPListResponse | undefined>(undefined)

	return availableMcpPromise.then((mcpDetails) =>
		FlowApi.getMCPUserSettings({
			code: item?.id,
			redirectUrl: generateCallbackUrl(),
		}).then(async (data) => {
			try {
				if (data?.auth_type || (item?.require_fields && item?.require_fields?.length > 0)) {
					// Authorization required. Launch a new popup based on the returned form fields for user input.
					// After completion, poll the results in the form popup. Upon success, show success in the popup form,
					// then close the popup form and allow the user to add again
					await new Promise((resolve, reject) => {
						options.onOpen?.()
						if (options.panelVariant === "connector-market") {
							openConnectorAuthDialog({
								id: item.id,
								zIndex: options.zIndex,
								className: options.modalClassName,
								panelMode: options.panelMode,
								initialUserSettings: data,
								initialMcpDetails: mcpDetails,
								onSuccess: () => resolve(MCPOAuthType.successful),
								onClose: () => {
									options.onClose?.()
									reject(MCPOAuthType.validationFailed)
								},
							})
							return
						}

						openAgentCommonModal({
							width: options.modalWidth ?? 560,
							className: options.modalClassName,
							zIndex: options.zIndex,
							footer: null,
							closable: false,
							centered: false,
							isResponsive: false,
							onClose: () => {
								options.onClose?.()
								reject(MCPOAuthType.validationFailed)
							},
							children: (
								<MCPOAuth
									id={item?.id}
									panelVariant={options.panelVariant}
									panelMode={options.panelMode}
									initialUserSettings={data}
									initialMcpDetails={mcpDetails}
									onEnable={() => resolve(MCPOAuthType.successful)}
								/>
							),
						})
					})

					return MCPOAuthType.successful
				} else {
					return MCPOAuthType.noVerificationRequired
				}
			} catch (error) {
				console.error(error)
				return MCPOAuthType.validationFailed
			}
		}),
	)
}

export interface ConnectorAuthDialogProps {
	open: boolean
	id: string
	zIndex?: number
	className?: string
	panelMode?: "add" | "edit"
	initialUserSettings?: MCPOAuthStatus
	initialMcpDetails?: GetAvailableMCPListResponse
	onSuccess: () => void
	onAuthRevoked?: () => void
	onOpenChange: (open: boolean) => void
}

export function ConnectorAuthDialog({
	open,
	id,
	zIndex,
	className,
	panelMode,
	initialUserSettings,
	initialMcpDetails,
	onSuccess,
	onAuthRevoked,
	onOpenChange,
}: ConnectorAuthDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton={false}
				className={cn(
					"!max-h-[calc(100%-3rem)] !w-[calc(100%-2rem)] !max-w-[560px] !overflow-hidden !rounded-xl !border !bg-background !p-0 !shadow-sm",
					className,
				)}
				style={{ zIndex }}
				data-testid="connector-auth-dialog"
			>
				<MCPOAuth
					id={id}
					panelVariant="connector-market"
					panelMode={panelMode}
					initialUserSettings={initialUserSettings}
					initialMcpDetails={initialMcpDetails}
					onEnable={onSuccess}
					onAuthRevoked={onAuthRevoked}
					onClose={() => onOpenChange(false)}
				/>
			</DialogContent>
		</Dialog>
	)
}

interface OpenConnectorAuthDialogOptions {
	id: string
	zIndex?: number
	className?: string
	panelMode?: "add" | "edit"
	initialUserSettings?: MCPOAuthStatus
	initialMcpDetails?: GetAvailableMCPListResponse
	onSuccess: () => void
	onClose: () => void
}

function openConnectorAuthDialog(options: OpenConnectorAuthDialogOptions) {
	const div = document.createElement("div")
	document.body.appendChild(div)
	const root: Root = createRoot(div)
	let isCleanedUp = false

	const cleanup = () => {
		if (isCleanedUp) return
		isCleanedUp = true
		options.onClose()
		setTimeout(() => {
			root.unmount()
			div.remove()
		}, 0)
	}

	root.render(
		<AppearanceProvider>
			<ImperativeConnectorAuthDialog
				id={options.id}
				zIndex={options.zIndex}
				className={options.className}
				panelMode={options.panelMode}
				initialUserSettings={options.initialUserSettings}
				initialMcpDetails={options.initialMcpDetails}
				onSuccess={options.onSuccess}
				onClosed={cleanup}
			/>
		</AppearanceProvider>,
	)
}

function ImperativeConnectorAuthDialog(
	props: Omit<ConnectorAuthDialogProps, "open" | "onOpenChange"> & {
		onClosed: () => void
	},
) {
	const [open, setOpen] = useState(true)

	return (
		<ConnectorAuthDialog
			{...props}
			open={open}
			onOpenChange={(nextOpen) => {
				if (nextOpen) return
				setOpen(false)
				props.onClosed()
			}}
		/>
	)
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { IMCPItem } from "@/components/Agent/MCP/types"
import { FlowApi } from "@/apis"
import { generateCallbackUrl } from "@/components/Agent/MCP/helpers"
import { fetchConnectorAuthData } from "@/components/Agent/MCP/AgentSettings/AgentPanel/MCPPanel/helpers"
import type { MCPOAuthStatus } from "@/components/Agent/MCP/service/MCPOAuthService"
import type { GetAvailableMCPListResponse } from "@/types/flow"
import { getMCPAccess } from "@/components/Agent/MCP/store/mcp-access"
import type { MCPStore } from "@/components/Agent/MCP/store/mcp-store"

interface UseConnectorActionsOptions {
	/** Optional project-scoped store used when installing from an embedded panel. */
	activeAccess?: MCPStore
}

interface ConnectorStatusChangeOptions {
	zIndex?: number
	onNestedPanelOpen?: () => void
	onNestedPanelClose?: () => void
	modalClassName?: string
	modalWidth?: number | string
	panelVariant?: "default" | "connector-market"
	panelMode?: "add" | "edit"
}

export interface ConnectorAuthDialogState {
	id: string
	zIndex?: number
	className?: string
	panelMode: "add" | "edit"
	initialUserSettings: MCPOAuthStatus
	initialMcpDetails: GetAvailableMCPListResponse
}

const CONNECTOR_AUTH_MODAL_CLASS_NAME =
	"!max-h-[calc(100%-3rem)] !max-w-[560px] !overflow-hidden !rounded-xl !border !bg-background !p-0 !shadow-sm"

/** Connector market uses an isolated project setting bucket for added connectors. */
const CONNECTOR_MARKET_STORAGE_KEY = "__added__"

export function useConnectorActions({ activeAccess }: UseConnectorActionsOptions = {}) {
	const access = useMemo(() => getMCPAccess({ storageKey: CONNECTOR_MARKET_STORAGE_KEY }), [])
	const [selectedItems, setSelectedItems] = useState<IMCPItem[]>([])
	const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
	const inFlightIdsRef = useRef(new Set<string>())
	const [authDialog, setAuthDialog] = useState<ConnectorAuthDialogState | null>(null)
	const authDialogRef = useRef<ConnectorAuthDialogState | null>(null)
	const pendingAuthRef = useRef<{
		resolve?: (success: boolean) => void
		authorized?: boolean
		onNestedPanelClose?: () => void
	} | null>(null)

	useEffect(() => {
		void access
			.load()
			.then(() => setSelectedItems(access.mcpList))
			.catch(() => setSelectedItems([]))
	}, [access])

	const selectedIds = useMemo(
		() => new Set(selectedItems.map((item) => item.id)),
		[selectedItems],
	)

	const setLoading = useCallback((id: string, loading: boolean) => {
		setLoadingIds((current) => {
			const next = new Set(current)
			if (loading) next.add(id)
			else next.delete(id)
			return next
		})
	}, [])

	const revokeConnectorAuth = useCallback(async (item: IMCPItem) => {
		const userSettings = await FlowApi.getMCPUserSettings(
			{
				code: item.id,
				redirectUrl: generateCallbackUrl(),
			},
			{
				enableErrorMessagePrompt: false,
			},
		)

		if (userSettings?.auth_type) await FlowApi.unBindMCPOAuth(item.id)
	}, [])

	const saveConnectorSelections = useCallback(
		async (nextAddedItems: IMCPItem[], nextActiveItems?: IMCPItem[]) => {
			const previousAddedItems = access.mcpList
			const previousActiveItems = activeAccess?.mcpList
			try {
				await access.save({
					selectedIds: new Set(nextAddedItems.map((item) => item.id)),
					items: nextAddedItems,
				})
				if (activeAccess && nextActiveItems) {
					await activeAccess.save({
						selectedIds: new Set(nextActiveItems.map((item) => item.id)),
						items: nextActiveItems,
					})
				}
			} catch (error) {
				await Promise.allSettled([
					access.save({
						selectedIds: new Set(previousAddedItems.map((item) => item.id)),
						items: previousAddedItems,
					}),
					...(activeAccess && previousActiveItems
						? [
								activeAccess.save({
									selectedIds: new Set(
										previousActiveItems.map((item) => item.id),
									),
									items: previousActiveItems,
								}),
							]
						: []),
				])
				throw error
			}
		},
		[access, activeAccess],
	)

	const checkConnectorAuth = useCallback(
		async (item: IMCPItem, options: ConnectorStatusChangeOptions = {}) => {
			const { userSettings, mcpDetails, requiresAuth } = await fetchConnectorAuthData(item)
			if (!requiresAuth) return true
			if (authDialogRef.current) return false

			const dialogState: ConnectorAuthDialogState = {
				id: item.id,
				zIndex: options.zIndex,
				className: options.modalClassName ?? CONNECTOR_AUTH_MODAL_CLASS_NAME,
				panelMode: options.panelMode ?? "add",
				initialUserSettings: userSettings,
				initialMcpDetails: mcpDetails,
			}
			authDialogRef.current = dialogState
			options.onNestedPanelOpen?.()
			setAuthDialog(dialogState)

			return await new Promise<boolean>((resolve) => {
				pendingAuthRef.current = {
					resolve,
					onNestedPanelClose: options.onNestedPanelClose,
				}
			})
		},
		[],
	)

	const handleAuthDialogSuccess = useCallback(() => {
		const pending = pendingAuthRef.current
		if (pending) pending.authorized = true
	}, [])

	const handleAuthDialogRevoked = useCallback(() => {
		const pending = pendingAuthRef.current
		if (pending) pending.authorized = false
	}, [])

	const handleAuthDialogOpenChange = useCallback((open: boolean) => {
		if (open) return
		const pending = pendingAuthRef.current
		pendingAuthRef.current = null
		authDialogRef.current = null
		setAuthDialog(null)
		pending?.onNestedPanelClose?.()
		pending?.resolve?.(pending.authorized === true)
	}, [])

	const onStatusChange = useCallback(
		async (item: IMCPItem, options: ConnectorStatusChangeOptions = {}) => {
			if (inFlightIdsRef.current.has(item.id)) return false
			inFlightIdsRef.current.add(item.id)
			setLoading(item.id, true)
			try {
				if (activeAccess) await activeAccess.load()
				if (selectedIds.has(item.id)) {
					const nextItems = selectedItems.filter((candidate) => candidate.id !== item.id)
					await revokeConnectorAuth(item)
					const nextActiveItems = activeAccess?.mcpList.filter(
						(candidate) => candidate.id !== item.id,
					)
					await saveConnectorSelections(nextItems, nextActiveItems)
					setSelectedItems(nextItems)
					return true
				}

				if (!(await checkConnectorAuth(item, options))) return false

				const nextItems = [...selectedItems, item]
				const currentActiveItems = activeAccess?.mcpList ?? []
				const nextActiveItems = activeAccess
					? currentActiveItems.some((candidate) => candidate.id === item.id)
						? currentActiveItems
						: [...currentActiveItems, item]
					: undefined
				await saveConnectorSelections(nextItems, nextActiveItems)
				setSelectedItems(nextItems)
				return true
			} finally {
				setLoading(item.id, false)
				inFlightIdsRef.current.delete(item.id)
			}
		},
		[
			activeAccess,
			checkConnectorAuth,
			revokeConnectorAuth,
			saveConnectorSelections,
			selectedIds,
			selectedItems,
			setLoading,
		],
	)

	const onConfigure = useCallback(
		async (item: IMCPItem, options: ConnectorStatusChangeOptions = {}) => {
			if (inFlightIdsRef.current.has(item.id)) return false
			inFlightIdsRef.current.add(item.id)
			setLoading(item.id, true)
			try {
				return await checkConnectorAuth(item, options)
			} finally {
				setLoading(item.id, false)
				inFlightIdsRef.current.delete(item.id)
			}
		},
		[checkConnectorAuth, setLoading],
	)

	return {
		selectedItems,
		selectedIds,
		loadingIds,
		authDialog,
		handleAuthDialogSuccess,
		handleAuthDialogRevoked,
		handleAuthDialogOpenChange,
		onStatusChange,
		onConfigure,
	}
}

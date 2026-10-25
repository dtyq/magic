import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useCreation, useDebounceEffect, useMemoizedFn, useRequest } from "ahooks"
import type { IMCPItem } from "../../../types"
import {
	MCPManagerService,
	OfficialStrategy,
	OrganizationStrategy,
	PersonStrategy,
} from "../../../service/MCPManagerService"
import { openAgentCommonModal } from "../../../../AgentCommonModal"
import MCPForm from "../../../MCPForm"
import { checkMCPOAuth, MCPOAuthType } from "./helpers"
import { getMCPAccess } from "../../../store/mcp-access"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useMagicWidgetConfig } from "@/providers/MagicWidgetProvider"

export const enum MCPUserGroup {
	Official = "official",
	Organization = "organization",
	Person = "person",
}

const MCPStrategy = {
	[MCPUserGroup.Official]: OfficialStrategy,
	[MCPUserGroup.Organization]: OrganizationStrategy,
	[MCPUserGroup.Person]: PersonStrategy,
}

interface UseMCPPanelControllerProps {
	onSuccessCallback?: () => void
	storageKey?: string
	useTempStorage?: boolean
}

export interface MCPPanelController {
	isMobile: boolean
	type: MCPUserGroup
	setType: (type: MCPUserGroup) => void
	searchText: string
	setSearchText: (value: string) => void
	data: IMCPItem[] | undefined
	loading: boolean
	refresh: () => void
	openCreateForm: () => void
	openEditForm: (item: IMCPItem) => void
	onStatusChange: (item: IMCPItem) => Promise<void>
	usableCache: Set<string>
	selectedCount: number
	authModalState: { open: boolean; resourceId: string }
	openManageAuth: (item: IMCPItem) => void
	closeManageAuth: () => void
}

export function useMCPPanelController(props: UseMCPPanelControllerProps): MCPPanelController {
	const { onSuccessCallback, storageKey, useTempStorage = false } = props

	const isMobile = useIsMobile()
	const widgetContext = useMagicWidgetConfig()

	const mcpAccess = useCreation(
		() =>
			getMCPAccess({
				storageKey,
				useTempStorage,
			}),
		[storageKey, useTempStorage],
	)

	const service = useCreation(() => new MCPManagerService(), [])

	const [type, setType] = useState(MCPUserGroup.Official)
	const [searchText, setSearchText] = useState("")
	const [authModalState, setAuthModalState] = useState({ open: false, resourceId: "" })

	const openManageAuth = useMemoizedFn((item: IMCPItem) => {
		setAuthModalState({ open: true, resourceId: item.id })
	})

	const closeManageAuth = useMemoizedFn(() => {
		setAuthModalState({ open: false, resourceId: "" })
	})
	const hasInitializedSearch = useRef(false)
	const latestSearchTextRef = useRef("")
	const [selectedItems, setSelectedItems] = useState<IMCPItem[]>([])

	useEffect(() => {
		latestSearchTextRef.current = searchText
	}, [searchText])

	const { run, data, loading, refresh } = useRequest(
		(name?: string) => service.getMCPList(name),
		{
			manual: true,
		},
	)

	useEffect(() => {
		mcpAccess.load().catch(console.error)
	}, [mcpAccess])

	const selectedMCPIds = mcpAccess.mcpList.map((item) => item.id).join(",")

	useEffect(() => {
		setSelectedItems(mcpAccess.mcpList)
	}, [selectedMCPIds])

	const usableCache = useMemo(
		() => new Set(selectedItems.map((item) => item.id)),
		[selectedItems],
	)

	useDebounceEffect(
		() => {
			if (!hasInitializedSearch.current) {
				hasInitializedSearch.current = true
				return
			}
			run(searchText)
		},
		[searchText],
		{ wait: 1000, leading: false },
	)

	const submit = useMemoizedFn(async (items: IMCPItem[]) => {
		await mcpAccess.save({
			selectedIds: new Set(items.map((item) => item.id)),
			items,
		})

		onSuccessCallback?.()
	})

	const toggleMCP = useMemoizedFn((id: string) => {
		const item = data?.find((candidate) => candidate.id === id)
		const nextSelection = selectedItems.some((candidate) => candidate.id === id)
			? selectedItems.filter((candidate) => candidate.id !== id)
			: item
				? [...selectedItems, item]
				: selectedItems

		setSelectedItems(nextSelection)
		if (nextSelection !== selectedItems) submit(nextSelection).catch(console.error)
	})

	const onOAuthCallback = useMemoizedFn(async (id: string) => {
		toggleMCP(id)
	})

	const onStatusChange = useMemoizedFn(async (item: IMCPItem) => {
		if (usableCache.has(item.id)) {
			toggleMCP(item.id)
			return
		}

		const authType = await checkMCPOAuth(item)
		if (authType === MCPOAuthType.successful) {
			await onOAuthCallback(item.id)
			return
		}

		if (authType === MCPOAuthType.noVerificationRequired) {
			toggleMCP(item.id)
		}
	})

	const openEditForm = useMemoizedFn((item: IMCPItem) => {
		openAgentCommonModal({
			width: 600,
			footer: null,
			closable: false,
			centered: isMobile,
			isResponsive: false,
			widgetContext,
			children: <MCPForm id={item.id} onSuccessCallback={refresh} />,
		})
	})

	const openCreateForm = useMemoizedFn(() => {
		openAgentCommonModal({
			width: 600,
			footer: null,
			closable: false,
			widgetContext,
			children: <MCPForm onSuccessCallback={refresh} />,
		})
	})

	useLayoutEffect(() => {
		try {
			const Strategy = MCPStrategy[type]
			service.setContext(new Strategy())
			run(latestSearchTextRef.current)
		} catch (error) {
			console.error(error)
		}
	}, [run, service, type])

	return {
		isMobile,
		type,
		setType,
		searchText,
		setSearchText,
		data,
		loading,
		refresh,
		openCreateForm,
		openEditForm,
		onStatusChange,
		usableCache,
		selectedCount: usableCache.size,
		authModalState,
		openManageAuth,
		closeManageAuth,
	}
}

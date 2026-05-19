import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useCreation, useDebounceEffect, useMemoizedFn, useRequest, useResponsive } from "ahooks"
import { useImmer } from "use-immer"
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
}

export function useMCPPanelController(props: UseMCPPanelControllerProps): MCPPanelController {
	const { onSuccessCallback, storageKey, useTempStorage = false } = props

	const { md } = useResponsive()
	const isMobile = !md

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
	const hasInitializedSearch = useRef(false)
	const latestSearchTextRef = useRef("")
	const [usableCache, setUsableCache] = useImmer<Set<string>>(new Set())

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
		setUsableCache((draft) => {
			draft.clear()
			mcpAccess.mcpList.forEach((item) => {
				draft.add(item.id)
			})
		})
	}, [mcpAccess, selectedMCPIds, setUsableCache])

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

	const submit = useMemoizedFn(async (selectedIds: Set<string>) => {
		await mcpAccess.save({
			selectedIds,
			items: data || [],
		})

		onSuccessCallback?.()
	})

	const onOAuthCallback = useMemoizedFn(async (id: string) => {
		setUsableCache((draft) => {
			if (draft.has(id)) draft.delete(id)
			else draft.add(id)

			submit(draft).catch(console.error)
		})
	})

	const onStatusChange = useMemoizedFn(async (item: IMCPItem) => {
		if (usableCache.has(item.id)) {
			setUsableCache((draft) => {
				if (draft.has(item.id)) draft.delete(item.id)
				else draft.add(item.id)

				submit(draft).catch(console.error)
			})
			return
		}

		const authType = await checkMCPOAuth(item)
		if (authType === MCPOAuthType.successful) {
			await onOAuthCallback(item.id)
			return
		}

		if (authType === MCPOAuthType.noVerificationRequired) {
			setUsableCache((draft) => {
				if (draft.has(item.id)) draft.delete(item.id)
				else draft.add(item.id)

				submit(draft).catch(console.error)
			})
		}
	})

	const openEditForm = useMemoizedFn((item: IMCPItem) => {
		openAgentCommonModal({
			width: 600,
			footer: null,
			closable: false,
			centered: isMobile,
			isResponsive: false,
			children: <MCPForm id={item.id} onSuccessCallback={refresh} />,
		})
	})

	const openCreateForm = useMemoizedFn(() => {
		openAgentCommonModal({
			width: 600,
			footer: null,
			closable: false,
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
	}
}

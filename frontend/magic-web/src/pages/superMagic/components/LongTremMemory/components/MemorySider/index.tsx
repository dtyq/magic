import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Ellipsis, Plus, Search, SquarePen, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { LongMemoryApi } from "@/apis"
import MagicModal from "@/components/base/MagicModal"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import magicToast from "@/components/base/MagicToaster/utils"
import { Button } from "@/components/shadcn-ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import { Input } from "@/components/shadcn-ui/input"
import { SmoothTabs } from "@/components/shadcn-ui/smooth-tabs"
import { Switch } from "@/components/shadcn-ui/switch"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import routeManageService from "@/pages/superMagic/services/routeManageService"
import { LongMemory } from "@/types/longMemory"
import { openLongTremMemoryModal } from "../.."
import LongTremMemoryView from "../../LongTremMemory"
import { LongTremMemoryPage, MemoryTypeTab } from "../../types"

interface LongTremMemorySiderProps {
	projectId?: string | null
	className?: string
}

interface MobileMemoryPopupState {
	open: boolean
	initialPage?: LongTremMemoryPage
	initialEditMemory?: LongMemory.Memory
	initialSelectedProjectId?: string
}

export const LongTremMemorySider = memo(function LongTremMemorySider({
	projectId,
	className,
}: LongTremMemorySiderProps) {
	const { t } = useTranslation("super/longMemory")
	const isMobile = useIsMobile()
	const [activeTab, setActiveTab] = useState<MemoryTypeTab>(MemoryTypeTab.ProjectMemory)
	const [globalMemories, setGlobalMemories] = useState<LongMemory.Memory[]>([])
	const [projectMemories, setProjectMemories] = useState<LongMemory.Memory[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [isSearchVisible, setIsSearchVisible] = useState(false)
	const [searchValue, setSearchValue] = useState("")
	const [openActionMemoryId, setOpenActionMemoryId] = useState<string | null>(null)
	const [mobileMemoryPopupState, setMobileMemoryPopupState] = useState<MobileMemoryPopupState>({
		open: false,
	})
	const searchInputRef = useRef<HTMLInputElement>(null)

	const fetchMemories = useCallback(async () => {
		try {
			setIsLoading(true)
			const res = await LongMemoryApi.getMemories({
				status: [LongMemory.MemoryStatus.ACTIVE, LongMemory.MemoryStatus.PENDING_REVISION],
				page_size: 99,
			})

			if (!res?.success) {
				setGlobalMemories([])
				setProjectMemories([])
				return
			}

			setGlobalMemories(res.data.filter((memory) => memory.project_id === null))
			setProjectMemories(
				res.data.filter(
					(memory) => memory.project_id !== null && memory.project_id === projectId,
				),
			)
		} catch (error) {
			console.error("Failed to fetch long memories:", error)
			setGlobalMemories([])
			setProjectMemories([])
		} finally {
			setIsLoading(false)
		}
	}, [projectId])

	useEffect(() => {
		fetchMemories()
	}, [fetchMemories])

	useEffect(() => {
		if (!isSearchVisible) return
		searchInputRef.current?.focus()
	}, [isSearchVisible])

	const tabs = useMemo(
		() => [
			{
				value: MemoryTypeTab.GlobalMemory,
				label: t("globalMemory"),
			},
			{
				value: MemoryTypeTab.ProjectMemory,
				label: t("projectMemory"),
			},
		],
		[t],
	)

	const currentMemories = useMemo(
		() => (activeTab === MemoryTypeTab.GlobalMemory ? globalMemories : projectMemories),
		[activeTab, globalMemories, projectMemories],
	)

	const filteredMemories = useMemo(() => {
		const normalizedSearch = searchValue.trim().toLowerCase()
		if (!normalizedSearch) return currentMemories

		return currentMemories.filter((memory) => {
			const preview = getMemoryPreview(memory)
			return preview.title.toLowerCase().includes(normalizedSearch)
		})
	}, [currentMemories, searchValue])

	const initialSelectedProjectId =
		activeTab === MemoryTypeTab.ProjectMemory ? (projectId ?? undefined) : undefined

	const handleSearchToggle = useCallback(() => {
		setIsSearchVisible((prev) => {
			if (prev) setSearchValue("")
			return !prev
		})
	}, [])

	const handleCloseMobileMemoryPopup = useCallback(() => {
		setMobileMemoryPopupState({
			open: false,
		})
	}, [])

	const handleOpenCreate = useCallback(() => {
		if (isMobile) {
			setMobileMemoryPopupState({
				open: true,
				initialPage: LongTremMemoryPage.CreateOrEdit,
				initialSelectedProjectId,
			})
			return
		}

		openLongTremMemoryModal({
			onWorkspaceStateChange: routeManageService.navigateToState,
			initialPage: LongTremMemoryPage.CreateOrEdit,
			initialSelectedProjectId,
			closeOnCreateSuccess: true,
			onMemoryChanged: fetchMemories,
		})
	}, [fetchMemories, initialSelectedProjectId, isMobile])

	const handleOpenEdit = useCallback(
		(memory: LongMemory.Memory) => {
			setOpenActionMemoryId(null)

			if (isMobile) {
				setMobileMemoryPopupState({
					open: true,
					initialPage: LongTremMemoryPage.CreateOrEdit,
					initialEditMemory: memory,
				})
				return
			}

			openLongTremMemoryModal({
				onWorkspaceStateChange: routeManageService.navigateToState,
				initialPage: LongTremMemoryPage.CreateOrEdit,
				initialEditMemory: memory,
				closeOnCreateSuccess: true,
				onMemoryChanged: fetchMemories,
			})
		},
		[fetchMemories, isMobile],
	)

	const handleEnabledChange = useCallback(
		async (memoryId: string, enabled: boolean) => {
			try {
				const res = await LongMemoryApi.batchEnableMemories([memoryId], enabled)
				if (!res?.success) return

				setGlobalMemories((prev) => updateMemoryEnabled(prev, memoryId, enabled))
				setProjectMemories((prev) => updateMemoryEnabled(prev, memoryId, enabled))
				magicToast.success(enabled ? t("enabledSuccess") : t("disabledSuccess"))
			} catch (error) {
				console.error("Failed to update long memory enabled state:", error)
			}
		},
		[t],
	)

	const handleDeleteMemory = useCallback(
		async (memoryId: string) => {
			try {
				const res = await LongMemoryApi.deleteMemory(memoryId)
				if (!res) return

				setGlobalMemories((prev) => prev.filter((memory) => memory.id !== memoryId))
				setProjectMemories((prev) => prev.filter((memory) => memory.id !== memoryId))
				magicToast.success(t("deleteSuccess"))
			} catch (error) {
				console.error("Failed to delete long memory:", error)
			}
		},
		[t],
	)

	const handleDeleteConfirm = useCallback(
		(memory: LongMemory.Memory) => {
			setOpenActionMemoryId(null)
			MagicModal.confirm({
				title: t("deleteMemoryConfirm"),
				content: t("deleteMemoryConfirmContent"),
				variant: "destructive",
				showIcon: true,
				centered: true,
				okText: t("confirm"),
				cancelText: t("cancel"),
				onOk: () => handleDeleteMemory(memory.id),
			})
		},
		[handleDeleteMemory, t],
	)

	const emptyText =
		activeTab === MemoryTypeTab.ProjectMemory ? t("projectMemoryEmpty") : t("memoryListEmpty")

	return (
		<div
			className={cn("flex h-full min-h-0 flex-col", className)}
			data-testid="long-memory-sider-panel"
		>
			<div className="flex h-8 shrink-0 items-center justify-between px-2">
				<SmoothTabs
					tabs={tabs}
					value={activeTab}
					onChange={(value) => setActiveTab(value as MemoryTypeTab)}
					variant="background"
					className="h-7 bg-muted p-[3px]"
					buttonClassName="h-[22px] px-2 py-0 text-xs"
					indicatorClassName="inset-y-[3px] h-[22px]"
					showTooltip={false}
				/>
				<div className="flex items-center gap-0.5">
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="size-6 text-foreground"
						onClick={handleSearchToggle}
						aria-label={t("searchMemoryPlaceholder")}
						data-testid="long-memory-sider-search-trigger"
					>
						<Search />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="size-6 text-foreground"
						onClick={handleOpenCreate}
						aria-label={t("addMemory")}
						data-testid="long-memory-sider-create-trigger"
					>
						<Plus />
					</Button>
				</div>
			</div>

			{isSearchVisible && (
				<div className="shrink-0 p-2">
					<div className="relative">
						<Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							ref={searchInputRef}
							value={searchValue}
							onChange={(event) => setSearchValue(event.target.value)}
							placeholder={t("searchMemoryPlaceholder")}
							className="h-8 border-border bg-background pl-8 pr-2 text-sm focus-visible:ring-0"
							data-testid="long-memory-sider-search-input"
						/>
					</div>
				</div>
			)}

			<div
				className="scrollbar-y-thin min-h-0 flex-1 overflow-y-auto px-2 pb-2"
				data-testid="long-memory-sider-list"
			>
				{isLoading ? (
					<div
						className="flex h-full min-h-24 items-center justify-center text-sm text-muted-foreground"
						data-testid="long-memory-sider-loading"
					>
						{t("loading")}
					</div>
				) : filteredMemories.length === 0 ? (
					<div
						className="flex h-full min-h-24 items-center justify-center text-center text-sm text-muted-foreground"
						data-testid="long-memory-sider-empty"
					>
						{emptyText}
					</div>
				) : (
					<div className="flex flex-col gap-0.5">
						{filteredMemories.map((memory) => {
							const preview = getMemoryPreview(memory)
							const isActionOpen = openActionMemoryId === memory.id

							return (
								<div
									key={memory.id}
									className={cn(
										"group flex items-start gap-2 rounded-md px-2 py-2 transition-colors hover:bg-muted/80",
										isActionOpen && "bg-muted",
									)}
									data-testid="long-memory-sider-item"
								>
									<Switch
										checked={memory.enabled}
										onCheckedChange={(enabled) =>
											handleEnabledChange(memory.id, enabled)
										}
										className="mt-0.5 data-[state=checked]:bg-foreground"
										aria-label={preview.title}
										data-testid="long-memory-sider-item-switch"
									/>

									<div className="min-w-0 flex-1">
										<div
											className="truncate text-sm font-medium text-foreground"
											title={preview.title}
										>
											{preview.title}
										</div>
										<div
											className="mt-1 line-clamp-2 text-xs text-muted-foreground"
											title={preview.description}
										>
											{preview.description}
										</div>
									</div>

									<DropdownMenu
										onOpenChange={(open) =>
											setOpenActionMemoryId(open ? memory.id : null)
										}
									>
										<DropdownMenuTrigger>
											<Button
												type="button"
												variant="ghost"
												size="icon-sm"
												className={cn(
													"mt-0.5 size-6 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100",
													isActionOpen && "opacity-100",
												)}
												aria-label={t("manageMemory")}
												data-testid="long-memory-sider-item-menu-trigger"
											>
												<Ellipsis />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent
											align="end"
											sideOffset={6}
											className="min-w-[140px] rounded-md p-1 shadow-md"
										>
											<DropdownMenuItem
												onClick={() => handleOpenEdit(memory)}
												className="relative rounded-sm py-1.5 pl-8 pr-2 text-sm font-normal"
												data-testid="long-memory-sider-item-edit"
											>
												<SquarePen className="absolute left-2 top-1/2 size-4 -translate-y-1/2" />
												{t("edit")}
											</DropdownMenuItem>
											<DropdownMenuSeparator />
											<DropdownMenuItem
												variant="destructive"
												onClick={() => handleDeleteConfirm(memory)}
												className="relative rounded-sm py-1.5 pl-8 pr-2 text-sm font-normal"
												data-testid="long-memory-sider-item-delete"
											>
												<Trash2 className="absolute left-2 top-1/2 size-4 -translate-y-1/2" />
												{t("deleteMemory")}
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
							)
						})}
					</div>
				)}
			</div>

			{isMobile && (
				<MagicPopup
					visible={mobileMemoryPopupState.open}
					onClose={handleCloseMobileMemoryPopup}
					position="bottom"
					className="!pb-0"
					bodyClassName="!p-0"
					data-testid="long-memory-sider-mobile-popup"
				>
					<LongTremMemoryView
						onClose={handleCloseMobileMemoryPopup}
						onWorkspaceStateChange={routeManageService.navigateToState}
						initialPage={mobileMemoryPopupState.initialPage}
						initialEditMemory={mobileMemoryPopupState.initialEditMemory}
						initialSelectedProjectId={mobileMemoryPopupState.initialSelectedProjectId}
						closeOnCreateSuccess
						onMemoryChanged={fetchMemories}
					/>
				</MagicPopup>
			)}
		</div>
	)
})

function updateMemoryEnabled(memories: LongMemory.Memory[], memoryId: string, enabled: boolean) {
	return memories.map((memory) => (memory.id === memoryId ? { ...memory, enabled } : memory))
}

function getMemoryDisplayText(memory: LongMemory.Memory) {
	return (memory.origin_text || memory.content || memory.pending_content || "")
		.replace(/\s+/g, " ")
		.trim()
}

function getMemoryPreview(memory: LongMemory.Memory) {
	const description = getMemoryDisplayText(memory)
	const firstTag = memory.tags.find((tag) => tag.trim())
	if (!description) {
		return {
			title: firstTag?.trim() || "",
			description: "",
		}
	}

	if (firstTag) {
		return {
			title: firstTag.trim(),
			description,
		}
	}

	const colonMatch = description.match(/^([^:：]{1,18})[:：]/)
	if (colonMatch) {
		return {
			title: colonMatch[1].trim(),
			description,
		}
	}

	const title = description.split(/[\n，。,；;]/)[0]?.trim() || description

	return {
		title,
		description,
	}
}

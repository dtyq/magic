import {
	AssetsApi,
	type AssetComplianceStatus,
	type AssetItem,
	type AssetMediaType,
	type AssetScope,
	type AssetVisibilityConfig,
	type AssetVisibilityType,
} from "@/apis"
import { Button } from "@/components/shadcn-ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/shadcn-ui/dialog"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import { Input } from "@/components/shadcn-ui/input"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import { Switch } from "@/components/shadcn-ui/switch"
import { useUserInfo } from "@/models/user/hooks"
import { cn } from "@/utils/cn"
import { ChevronDown, LoaderCircle, RefreshCw, Search, Trash2, UserRound } from "lucide-react"
import { toast } from "sonner"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useOptionalCanvas } from "../../app/providers/CanvasProvider"
import { useCanvasDesignI18n } from "../../app/providers/I18nProvider"
import { useSeedanceComplianceAvailable } from "../seedanceComplianceAvailability"
import type {
	CanvasAssetComplianceState,
	CanvasAssetResourceInfo,
	CanvasEditAssetTarget,
} from "../../public/magic-types"
import {
	assetLibrarySessionStore,
	type AssetLibraryQuery,
} from "../../runtime/resources/asset/AssetLibrarySessionStore"
import { resolveAssetComplianceTaskManager } from "../../runtime/resources/asset/assetCompliancePollingHost"
import { reconcileDeletedAssetOnCanvas } from "../../runtime/resources/asset/canvasAssetDocumentReconcile"
import { useAssetLibrarySession } from "../../runtime/resources/asset/useAssetLibrarySession"
import MediaResourceFullscreenPreview, {
	type MediaResourceFullscreenPreviewItem,
} from "../fullscreen/media-resource/index"
import { AssetLibraryAssetCard } from "./asset-library/AssetLibraryAssetCard"
import { useAssetLibraryComplianceAction } from "./asset-library/useAssetLibraryComplianceAction"
import { AssetLibraryTransferOwnerDialog } from "./asset-library/AssetLibraryTransferOwnerDialog"
import { AssetLibraryUploadCard } from "./asset-library/AssetLibraryUploadCard"
import {
	canFilterAssetLibraryMedia,
	canUploadAssetLibraryMedia,
	resolveAssetLibraryQueryMediaTypes,
	toAssetLibraryFullscreenPreviewItem,
	type AssetLibraryMediaFilter,
	type AssetLibraryUploadMode,
} from "./asset-library/assetLibraryMedia"

export interface AssetsModalProps {
	open: boolean
	onClose: () => void
	/** 返回用户确认的资产；具体落图或加入编辑器由调用方决定。 */
	onConfirm?: (asset: AssetItem) => void | Promise<void>
	/** 多选模式下返回全部已选资产；单选入口继续使用 onConfirm。 */
	onConfirmMultiple?: (assets: AssetItem[]) => void | Promise<void>
	/** 当前入口允许选择的媒体类型；全部图片/视频时由查询层使用无类型过滤请求。 */
	mediaTypes?: readonly AssetMediaType[]
	/** 需要合规素材的入口只查询 PASS 素材；普通素材入口展示全部状态。 */
	requiresCompliance?: boolean
	/** 是否允许多选；不传时保持单选行为。 */
	multiple?: boolean
	/** 当前入口最多可确认的数量；未传时多选不设置业务数量上限。 */
	maxCount?: number
}

type AssetsScope = Extract<AssetScope, "ALL" | "PERSONAL" | "TEAM">

interface AssetQueryState {
	scope: AssetsScope
	keyword: string
	ownerUid: string
}

const DEFAULT_QUERY: AssetQueryState = {
	scope: "ALL",
	keyword: "",
	ownerUid: "",
}

const DEFAULT_MEDIA_TYPES: readonly AssetMediaType[] = ["IMAGE"]
const ASSET_BATCH_MUTATION_LIMIT = 100

// Keep this picker below the shared Toast layer without changing other dialogs.
const ASSET_LIBRARY_DIALOG_Z_INDEX = 999

function getVisibilityTargetName(target: { id: string; nickname?: string; name?: string }): string {
	return target.nickname?.trim() || target.name?.trim() || target.id
}

function buildEditVisibility(
	config: AssetVisibilityConfig | undefined,
	currentUserId: string,
	assetVisibilityType?: AssetVisibilityType,
): Pick<
	CanvasEditAssetTarget,
	"visibility" | "userIds" | "departmentIds" | "visibilityTargets" | "visibilityEditable"
> {
	const users = Array.isArray(config?.users) ? config.users : []
	const departments = Array.isArray(config?.departments) ? config.departments : []
	const visibilityType = Number(config?.visibility_type)
	const userIds = Array.from(
		new Set(users.map((target) => String(target.id).trim()).filter(Boolean)),
	)
	const departmentIds = Array.from(
		new Set(departments.map((target) => String(target.id).trim()).filter(Boolean)),
	)
	const visibilityTargets = [
		...users
			.filter((target) => String(target.id).trim())
			.map((target) => ({
				id: String(target.id),
				name: getVisibilityTargetName(target),
				type: "user" as const,
			})),
		...departments
			.filter((target) => String(target.id).trim())
			.map((target) => ({
				id: String(target.id),
				name: getVisibilityTargetName(target),
				type: "department" as const,
			})),
	]
	const onlyCurrentUser =
		departmentIds.length === 0 &&
		userIds.length <= 1 &&
		(userIds.length === 0 || (currentUserId !== "" && userIds[0] === currentUserId))

	const isTeamVisible =
		assetVisibilityType === "TEAM" ||
		(assetVisibilityType === undefined && (visibilityType === 1 || !onlyCurrentUser))

	return {
		visibility: isTeamVisible ? "team" : "private",
		userIds,
		departmentIds,
		visibilityTargets,
		// The update contract supports specific users/departments. An organization-wide
		// visibility record cannot be represented by those arrays, so keep it read-only.
		visibilityEditable:
			(visibilityType === 0 || visibilityType === 2) &&
			Array.isArray(config?.users) &&
			Array.isArray(config?.departments),
	}
}

const SCOPE_OPTIONS: Array<{ value: AssetsScope; key: string; fallback: string }> = [
	{ value: "ALL", key: "assets.allAssets", fallback: "全部素材" },
	{ value: "PERSONAL", key: "assets.personalAssets", fallback: "仅自己可见" },
	{ value: "TEAM", key: "assets.teamAssets", fallback: "团队可见" },
]

/**
 * 素材库弹窗只负责选择资产。
 * file_url 只作为当前列表的预览地址；调用方根据 asset_id 决定复用或导入当前画布。
 */
export default function AssetsModal({
	open,
	onClose,
	onConfirm,
	onConfirmMultiple,
	mediaTypes = DEFAULT_MEDIA_TYPES,
	requiresCompliance = false,
	multiple = false,
	maxCount,
}: AssetsModalProps) {
	const { t } = useCanvasDesignI18n()
	const canvas = useOptionalCanvas()
	const seedanceComplianceAvailable = useSeedanceComplianceAvailable()
	const { userInfo } = useUserInfo()
	const currentUserId = userInfo?.user_id?.trim() || ""
	const [hostDialogOpen, setHostDialogOpen] = useState(false)
	const [cardMenuOpen, setCardMenuOpen] = useState(false)
	const [batchMenuOpen, setBatchMenuOpen] = useState(false)
	const [transferAssets, setTransferAssets] = useState<AssetItem[]>([])
	const mediaTypesKey = mediaTypes.join("|")
	const requestedMediaTypes = useMemo(() => {
		const normalized = Array.from(new Set(mediaTypes))
		return normalized.length > 0 ? normalized : [...DEFAULT_MEDIA_TYPES]
		// mediaTypesKey stabilizes semantically identical arrays supplied by slot renders.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [mediaTypesKey])
	const [query, setQuery] = useState(DEFAULT_QUERY)
	const [mediaFilter, setMediaFilter] = useState<AssetLibraryMediaFilter>("ALL")
	const [verifiedOnly, setVerifiedOnly] = useState(false)
	const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([])
	const [confirming, setConfirming] = useState(false)
	const [batchActionPending, setBatchActionPending] = useState(false)
	const [confirmError, setConfirmError] = useState(false)
	const [previewResource, setPreviewResource] =
		useState<MediaResourceFullscreenPreviewItem | null>(null)
	// Touch dismiss is deferred to the document click. Closing the preview on that
	// same click clears preview state before Radix checks outside interaction.
	const suppressLibraryDismissRef = useRef(false)
	const [optimisticProcessingIds, setOptimisticProcessingIds] = useState(() => new Set<string>())
	const [pendingComplianceIds, setPendingComplianceIds] = useState(() => new Set<string>())
	const complianceTaskManager = useMemo(() => resolveAssetComplianceTaskManager(canvas), [canvas])
	const selectionLimit =
		maxCount === undefined
			? multiple
				? Number.POSITIVE_INFINITY
				: 1
			: Math.max(0, Math.floor(maxCount))
	const showSelectionCount = Number.isFinite(selectionLimit) && selectionLimit > 1
	const showMediaFilter = canFilterAssetLibraryMedia(requestedMediaTypes)
	const canUpload = canUploadAssetLibraryMedia(requestedMediaTypes)
	const complianceRequired = requiresCompliance || (seedanceComplianceAvailable && verifiedOnly)

	useEffect(() => {
		if (!seedanceComplianceAvailable && verifiedOnly) {
			setVerifiedOnly(false)
		}
	}, [seedanceComplianceAvailable, verifiedOnly])
	const assetQuery = useMemo<AssetLibraryQuery>(
		() => ({
			mediaTypes: resolveAssetLibraryQueryMediaTypes(
				requestedMediaTypes,
				showMediaFilter ? mediaFilter : "ALL",
			),
			scope: query.scope,
			keyword: query.keyword,
			ownerUid: query.ownerUid,
			requiresCompliance: complianceRequired,
		}),
		[complianceRequired, mediaFilter, query, requestedMediaTypes, showMediaFilter],
	)
	const { assets, owners, loading, refreshing, error, refreshAssets } = useAssetLibrarySession(
		assetQuery,
		open,
	)

	const displayAssets = useMemo(() => {
		if (optimisticProcessingIds.size === 0) return assets
		return assets.map((asset) =>
			optimisticProcessingIds.has(asset.asset_id)
				? {
						...asset,
						compliance_status: "PROCESSING" as AssetComplianceStatus,
						compliance_failed_reason: null,
					}
				: asset,
		)
	}, [assets, optimisticProcessingIds])

	const selectedAssets = useMemo(
		() => displayAssets.filter((asset) => selectedAssetIds.includes(asset.asset_id)),
		[displayAssets, selectedAssetIds],
	)
	const showBatchActions = multiple && selectedAssets.length > 0

	const refreshLibraryAfterCompliance = useCallback((assetId: string) => {
		setOptimisticProcessingIds((current) => {
			if (!current.has(assetId)) return current
			const next = new Set(current)
			next.delete(assetId)
			return next
		})
	}, [])

	const { startCompliance } = useAssetLibraryComplianceAction({
		onComplianceStarted: (assetId) => {
			setOptimisticProcessingIds((current) => new Set(current).add(assetId))
		},
		onComplianceSettled: (assetId) => {
			refreshLibraryAfterCompliance(assetId)
		},
	})

	const handleComplianceCheck = useCallback(
		(asset: AssetItem) => {
			const assetId = asset.asset_id
			setPendingComplianceIds((current) => new Set(current).add(assetId))
			void startCompliance(asset).finally(() => {
				setPendingComplianceIds((current) => {
					if (!current.has(assetId)) return current
					const next = new Set(current)
					next.delete(assetId)
					return next
				})
			})
		},
		[startCompliance],
	)

	useEffect(() => {
		if (!open) {
			setPreviewResource(null)
			setOptimisticProcessingIds(new Set())
			setPendingComplianceIds(new Set())
			setTransferAssets([])
			setBatchMenuOpen(false)
			return
		}
		setSelectedAssetIds([])
		setConfirmError(false)
		setPreviewResource(null)
	}, [open])

	const handleComplianceSettled = useCallback(
		(state?: CanvasAssetComplianceState) => {
			const assetId = state?.assetId?.trim()
			if (assetId && canvas && !canvas.isDestroyed) {
				void canvas.assetResourceManager
					.refreshResources([assetId], { forceRefresh: true })
					.catch(() => undefined)
			}
		},
		[canvas],
	)

	const processingAssetIds = useMemo(() => {
		// Team-visible assets can appear in this list, but the compliance endpoints
		// only authorize the asset owner. Resume polling only for assets owned by the
		// current user so shared cards never create unauthorized background requests.
		const ownedAssetIds = new Set(
			assets
				.filter((asset) => currentUserId !== "" && asset.owner_uid === currentUserId)
				.map((asset) => asset.asset_id),
		)
		const ids = assets
			.filter(
				(asset) =>
					asset.compliance_status === "PROCESSING" && ownedAssetIds.has(asset.asset_id),
			)
			.map((asset) => asset.asset_id)
		for (const assetId of optimisticProcessingIds) {
			if (ownedAssetIds.has(assetId) && !ids.includes(assetId)) ids.push(assetId)
		}
		return ids
	}, [assets, currentUserId, optimisticProcessingIds])
	const processingAssetIdsKey = processingAssetIds.join("|")

	useEffect(() => {
		if (!open || processingAssetIds.length === 0) return
		return complianceTaskManager.resumeLibraryComplianceChecks(
			processingAssetIds,
			handleComplianceSettled,
		)
	}, [
		complianceTaskManager,
		handleComplianceSettled,
		open,
		processingAssetIds,
		processingAssetIdsKey,
	])

	useEffect(() => {
		setSelectedAssetIds((currentIds) => {
			const availableIds = new Set(assets.map((asset) => asset.asset_id))
			const nextIds = currentIds
				.filter((assetId) => availableIds.has(assetId))
				.slice(0, selectionLimit)
			return nextIds.length === currentIds.length &&
				nextIds.every((id, index) => id === currentIds[index])
				? currentIds
				: nextIds
		})
	}, [assets, selectionLimit])

	const handleAssetToggle = (assetId: string) => {
		setSelectedAssetIds((currentIds) => {
			if (currentIds.includes(assetId)) {
				return currentIds.filter((currentId) => currentId !== assetId)
			}
			if (currentIds.length >= selectionLimit) return currentIds
			return multiple ? [...currentIds, assetId] : [assetId]
		})
	}

	const handleUploaded = (
		asset: {
			asset_id: string
			asset_media_type: AssetMediaType | null
			compliance_status: AssetComplianceStatus
		},
		mode: AssetLibraryUploadMode,
	) => {
		const uploadedMediaType = asset.asset_media_type
		const shouldSwitchFilter =
			showMediaFilter &&
			(uploadedMediaType === "IMAGE" || uploadedMediaType === "VIDEO") &&
			mediaFilter !== "ALL" &&
			mediaFilter !== uploadedMediaType
		if (shouldSwitchFilter) {
			setMediaFilter(uploadedMediaType)
		}
		if (mode === "verify" && asset.asset_id) {
			complianceTaskManager.watchLibraryComplianceChecks(
				[asset.asset_id],
				handleComplianceSettled,
			)
		}
	}

	const refreshLibrary = (assetId?: string, refreshOwners = false) => {
		if (assetId) assetLibrarySessionStore.invalidateAsset(assetId)
		else assetLibrarySessionStore.invalidateCurrentScope()
		if (refreshOwners) {
			void assetLibrarySessionStore.refreshOwners().catch(() => undefined)
		}
	}

	const handleEditAsset = async (asset: AssetItem) => {
		const openEditAssetDialog = canvas?.magicConfigManager.config?.methods?.openEditAssetDialog
		if (!openEditAssetDialog) {
			toast.error(t("assets.editUnavailable", "当前无法编辑素材"))
			return
		}

		const baseTarget: Omit<
			CanvasEditAssetTarget,
			"visibility" | "userIds" | "departmentIds" | "visibilityTargets" | "visibilityEditable"
		> = {
			assetId: asset.asset_id,
			name: asset.name,
			description: asset.description,
			fileUrl: asset.file_url,
			mediaType:
				asset.asset_media_type === "VIDEO"
					? "video"
					: asset.asset_media_type === "AUDIO"
						? "audio"
						: asset.asset_media_type === "IMAGE"
							? "image"
							: null,
			tagIds: asset.tags.map((tag) => tag.id),
		}

		let visibility: Pick<
			CanvasEditAssetTarget,
			"visibility" | "userIds" | "departmentIds" | "visibilityTargets" | "visibilityEditable"
		>
		try {
			const response = await AssetsApi.getAssetVisibilityConfig(asset.asset_id)
			visibility = buildEditVisibility(
				response.visibility_config,
				currentUserId,
				asset.visibility_type,
			)
		} catch {
			// Older deployments may not expose the generic visibility endpoint. Keep
			// the permission controls read-only and omit visibility from PUT instead
			// of replacing an unknown authorization set with empty arrays.
			visibility = {
				visibility:
					asset.visibility_type === "TEAM" || asset.source === "TEAM"
						? "team"
						: "private",
				userIds: [],
				departmentIds: [],
				visibilityTargets: [],
				visibilityEditable: false,
			}
		}

		setHostDialogOpen(true)
		openEditAssetDialog({
			asset: {
				...baseTarget,
				...visibility,
			},
			// The host update handler upserts the PUT response into the shared store.
			// Avoid reloading the full list after a complete mutation response.
			onUpdated: () => undefined,
			onClosed: () => setHostDialogOpen(false),
		})
	}

	const handleDeleteAsset = async (asset: AssetItem) => {
		try {
			await AssetsApi.deleteAsset(asset.asset_id)
			if (canvas) {
				reconcileDeletedAssetOnCanvas(canvas, asset.asset_id)
			}
			assetLibrarySessionStore.removeAsset(asset.asset_id)
			setSelectedAssetIds((currentIds) => currentIds.filter((id) => id !== asset.asset_id))
			void assetLibrarySessionStore.refreshOwners().catch(() => undefined)
			toast.success(t("assets.deleteSuccess", "素材已删除"))
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: t("assets.deleteFailed", "删除素材失败，请重试"),
			)
		}
	}

	const resolveBatchAssetIds = (): string[] | null => {
		if (selectedAssets.length === 0) return null
		if (selectedAssets.length > ASSET_BATCH_MUTATION_LIMIT) {
			toast.error(
				t("assets.batchLimitExceeded", {
					defaultValue: "一次最多操作 {{count}} 个素材",
					count: ASSET_BATCH_MUTATION_LIMIT,
				}),
			)
			return null
		}
		if (
			!currentUserId ||
			selectedAssets.some((asset) => asset.owner_uid?.trim() !== currentUserId)
		) {
			toast.error(t("assets.batchOwnerOnly", "批量删除和转交仅支持选择自己拥有的素材"))
			return null
		}
		return selectedAssets.map((asset) => asset.asset_id)
	}

	const handleBatchDelete = async () => {
		if (batchActionPending) return
		const assetIds = resolveBatchAssetIds()
		if (!assetIds) return

		setBatchActionPending(true)
		try {
			const response = await AssetsApi.batchDeleteAssets({ asset_ids: assetIds })
			const deletedIds =
				Array.isArray(response.asset_ids) && response.asset_ids.length > 0
					? response.asset_ids
					: assetIds
			const deletedIdSet = new Set(deletedIds)
			for (const assetId of deletedIds) {
				if (canvas) reconcileDeletedAssetOnCanvas(canvas, assetId)
				assetLibrarySessionStore.removeAsset(assetId)
			}
			setSelectedAssetIds((currentIds) =>
				currentIds.filter((assetId) => !deletedIdSet.has(assetId)),
			)
			refreshLibrary(undefined, true)
			toast.success(
				t("assets.batchDeleteSuccess", {
					defaultValue: "已删除 {{count}} 个素材",
					count: deletedIds.length,
				}),
			)
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: t("assets.batchDeleteFailed", "批量删除素材失败，请重试"),
			)
		} finally {
			setBatchActionPending(false)
		}
	}

	const handleBatchTransfer = () => {
		if (batchActionPending || !resolveBatchAssetIds()) return
		setTransferAssets(selectedAssets)
	}

	const handleLocalFileSelected = (file: File, mode: AssetLibraryUploadMode) => {
		const openSaveLocalAssetDialog =
			canvas?.magicConfigManager.config?.methods?.openSaveLocalAssetDialog
		if (!openSaveLocalAssetDialog) {
			toast.error(t("assets.uploadFailed", "上传素材失败，请重试"))
			return
		}
		setHostDialogOpen(true)
		openSaveLocalAssetDialog({
			file,
			mode,
			onSaved: (asset: CanvasAssetResourceInfo) => {
				handleUploaded(
					{
						asset_id: asset.assetId,
						asset_media_type:
							asset.mediaType === "video"
								? "VIDEO"
								: asset.mediaType === "audio"
									? "AUDIO"
									: asset.mediaType === "image"
										? "IMAGE"
										: null,
						compliance_status: asset.complianceStatus ?? "UNVERIFIED",
					},
					mode,
				)
			},
			onClosed: () => setHostDialogOpen(false),
		})
	}

	const handleConfirm = async () => {
		if (selectedAssets.length === 0 || confirming) return

		setConfirming(true)
		setConfirmError(false)
		try {
			if (multiple) {
				if (onConfirmMultiple) {
					await onConfirmMultiple(selectedAssets)
				} else if (onConfirm) {
					await Promise.all(selectedAssets.map((asset) => onConfirm(asset)))
				}
			} else {
				await onConfirm?.(selectedAssets[0])
			}
			onClose()
		} catch {
			setConfirmError(true)
		} finally {
			setConfirming(false)
		}
	}

	// The fullscreen preview is portaled outside DialogContent. Keep the library
	// dialog open while its backdrop handles the click and closes only the preview.
	const blockLibraryDismiss =
		hostDialogOpen ||
		cardMenuOpen ||
		batchMenuOpen ||
		transferAssets.length > 0 ||
		Boolean(previewResource)

	return (
		<>
			<Dialog
				open={open}
				onOpenChange={(nextOpen) => {
					if (!nextOpen && !blockLibraryDismiss && !suppressLibraryDismissRef.current) {
						onClose()
					}
				}}
			>
				<DialogContent
					className="flex h-[min(940px,calc(100vh-64px))] max-h-[calc(100vh-64px)] w-[min(1120px,calc(100vw-32px))] !max-w-[1120px] flex-col gap-0 overflow-hidden p-0"
					data-testid="assets-modal"
					// Keep this picker below the global Toast layer so API errors remain visible;
					// the adjustment is local to this modal and does not change shared overlays.
					style={{ zIndex: ASSET_LIBRARY_DIALOG_Z_INDEX }}
					onOpenAutoFocus={(event) => event.preventDefault()}
					onPointerDownOutside={(event) => {
						if (blockLibraryDismiss || suppressLibraryDismissRef.current) {
							event.preventDefault()
						}
					}}
					onInteractOutside={(event) => {
						if (blockLibraryDismiss || suppressLibraryDismissRef.current) {
							event.preventDefault()
						}
					}}
					onFocusOutside={(event) => {
						if (blockLibraryDismiss || suppressLibraryDismissRef.current) {
							event.preventDefault()
						}
					}}
					onEscapeKeyDown={(event) => {
						if (blockLibraryDismiss || suppressLibraryDismissRef.current) {
							event.preventDefault()
						}
					}}
				>
					<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
						<DialogHeader className="shrink-0 border-b px-5 py-3 pr-12 text-left">
							<DialogTitle className="text-base font-semibold leading-6">
								{t("tools.assets", "素材库")}
							</DialogTitle>
						</DialogHeader>

						<div className="flex min-h-0 flex-1 flex-col px-5">
							<div
								className="flex shrink-0 flex-wrap items-center gap-3 border-b py-4"
								role="toolbar"
							>
								<div
									className="inline-flex shrink-0 gap-0.5 rounded-lg bg-muted p-0.5"
									role="tablist"
								>
									{SCOPE_OPTIONS.map((option) => (
										<button
											key={option.value}
											type="button"
											role="tab"
											aria-selected={query.scope === option.value}
											className={cn(
												"rounded-md px-3.5 py-1.5 text-sm leading-5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
												query.scope === option.value &&
													"bg-background text-primary shadow-sm",
											)}
											onClick={() =>
												setQuery((current) => ({
													...current,
													scope: option.value,
												}))
											}
										>
											{t(option.key, option.fallback)}
										</button>
									))}
								</div>

								<div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
									<span>{t("assets.owner", "归属人")}</span>
									<Select
										value={query.ownerUid || "all"}
										onValueChange={(value) =>
											setQuery((current) => ({
												...current,
												ownerUid: value === "all" ? "" : value,
											}))
										}
									>
										<SelectTrigger
											className="w-[140px] bg-background text-foreground"
											aria-label={t("assets.owner", "归属人")}
										>
											<SelectValue
												placeholder={t("assets.allOwners", "全部归属人")}
											/>
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">
												{t("assets.allOwners", "全部归属人")}
											</SelectItem>
											{owners.map((owner) => (
												<SelectItem key={owner.id} value={owner.id}>
													{owner.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								{seedanceComplianceAvailable ? (
									<label className="inline-flex shrink-0 items-center gap-2 text-sm text-foreground">
										<Switch
											checked={complianceRequired}
											disabled={requiresCompliance}
											aria-label={t("assets.verifiedOnly", "仅看已认证")}
											onCheckedChange={setVerifiedOnly}
										/>
										<span>{t("assets.verifiedOnly", "仅看已认证")}</span>
									</label>
								) : null}
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="size-8 shrink-0"
									disabled={loading || refreshing}
									aria-label={t("assets.refresh", "刷新素材")}
									title={t("assets.refresh", "刷新素材")}
									onClick={() => void refreshAssets().catch(() => undefined)}
								>
									<RefreshCw
										className={cn("size-4", refreshing && "animate-spin")}
										aria-hidden="true"
									/>
								</Button>

								<label className="relative ml-auto flex min-w-[220px] flex-1 items-center sm:max-w-[320px]">
									<Search
										className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
										aria-hidden="true"
									/>
									<Input
										className="pl-9"
										value={query.keyword}
										aria-label={t("assets.search", "搜索素材名称或标签")}
										placeholder={t("assets.search", "搜索素材名称或标签")}
										onChange={(event) =>
											setQuery((current) => ({
												...current,
												keyword: event.target.value,
											}))
										}
									/>
								</label>
							</div>

							{showMediaFilter || showBatchActions ? (
								<div className="flex shrink-0 items-center gap-3 border-b py-3">
									{showMediaFilter ? (
										<>
											<span className="text-sm text-muted-foreground">
												{t("assets.mediaType", "素材类型")}
											</span>
											<div
												className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5"
												role="tablist"
												aria-label={t("assets.mediaType", "素材类型")}
											>
												<button
													type="button"
													role="tab"
													aria-selected={mediaFilter === "ALL"}
													className={cn(
														"rounded-md px-3 py-1 text-sm leading-5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
														mediaFilter === "ALL" &&
															"bg-background text-primary shadow-sm",
													)}
													onClick={() => setMediaFilter("ALL")}
												>
													{t("assets.mediaTypeAll", "全部")}
												</button>
												<button
													type="button"
													role="tab"
													aria-selected={mediaFilter === "IMAGE"}
													className={cn(
														"rounded-md px-3 py-1 text-sm leading-5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
														mediaFilter === "IMAGE" &&
															"bg-background text-primary shadow-sm",
													)}
													onClick={() => setMediaFilter("IMAGE")}
												>
													{t("assets.mediaTypeImage", "图片")}
												</button>
												<button
													type="button"
													role="tab"
													aria-selected={mediaFilter === "VIDEO"}
													className={cn(
														"rounded-md px-3 py-1 text-sm leading-5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
														mediaFilter === "VIDEO" &&
															"bg-background text-primary shadow-sm",
													)}
													onClick={() => setMediaFilter("VIDEO")}
												>
													{t("assets.mediaTypeVideo", "视频")}
												</button>
											</div>
										</>
									) : null}
									{showBatchActions ? (
										<div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
											<span>
												{t("assets.selectedCountShort", {
													defaultValue: "已选 {{count}}",
													count: selectedAssets.length,
												})}
											</span>
											<DropdownMenu
												modal={false}
												onOpenChange={setBatchMenuOpen}
											>
												<DropdownMenuTrigger asChild>
													<Button
														type="button"
														variant="outline"
														size="sm"
														disabled={batchActionPending}
														aria-label={t(
															"assets.batchActions",
															"批量操作",
														)}
													>
														{t("assets.batchActions", "批量操作")}
														<ChevronDown
															className="ml-1 size-4"
															aria-hidden="true"
														/>
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem
														variant="destructive"
														disabled={batchActionPending}
														onSelect={() => void handleBatchDelete()}
													>
														<Trash2 aria-hidden="true" />
														{t("assets.batchDelete", "批量删除")}
													</DropdownMenuItem>
													<DropdownMenuItem
														disabled={batchActionPending}
														onSelect={handleBatchTransfer}
													>
														<UserRound aria-hidden="true" />
														{t("assets.batchTransferOwner", "批量转交")}
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</div>
									) : null}
								</div>
							) : null}

							{error !== null && (assets.length > 0 || canUpload) && (
								<div
									className="shrink-0 border-b bg-destructive/5 px-3 py-2 text-sm text-destructive"
									role="alert"
								>
									{t("assets.loadFailed", "素材库加载失败，请重试")}
								</div>
							)}

							<ScrollArea className="min-h-0 flex-1" viewportClassName="h-full">
								{loading ? (
									<div
										className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground"
										role="status"
									>
										<LoaderCircle className="size-5 animate-spin" />
										<span>{t("assets.loading", "加载中...")}</span>
									</div>
								) : error !== null && assets.length === 0 && !canUpload ? (
									<div
										className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground"
										role="alert"
									>
										<span>
											{t("assets.loadFailed", "素材库加载失败，请重试")}
										</span>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() =>
												void refreshAssets().catch(() => undefined)
											}
										>
											{t("common.retry", "重试")}
										</Button>
									</div>
								) : displayAssets.length === 0 && !canUpload ? (
									<div className="flex h-full min-h-[300px] items-center justify-center text-sm text-muted-foreground">
										<span>{t("assets.empty", "暂无素材")}</span>
									</div>
								) : (
									/* Overlay scrollbar covers the right edge. Matching left padding keeps the card grid symmetric. */
									<div className="grid grid-cols-2 gap-4 px-4 py-5 sm:grid-cols-3 lg:grid-cols-4">
										{canUpload ? (
											<AssetLibraryUploadCard
												allowedMediaTypes={requestedMediaTypes}
												t={t}
												seedanceComplianceAvailable={
													seedanceComplianceAvailable
												}
												ensureAssetAgreementSigned={
													canvas?.magicConfigManager.config?.methods
														?.ensureAssetAgreementSigned
												}
												onAgreementActivityChange={setHostDialogOpen}
												onFileSelected={handleLocalFileSelected}
											/>
										) : null}
										{displayAssets.map((asset) => {
											const selected = selectedAssetIds.includes(
												asset.asset_id,
											)
											const manageable = Boolean(
												currentUserId && asset.owner_uid === currentUserId,
											)
											return (
												<AssetLibraryAssetCard
													key={asset.asset_id}
													asset={asset}
													selected={selected}
													selectionBlocked={
														!selected &&
														selectedAssetIds.length >= selectionLimit
													}
													t={t}
													manageable={manageable}
													complianceActionPending={pendingComplianceIds.has(
														asset.asset_id,
													)}
													seedanceComplianceAvailable={
														seedanceComplianceAvailable
													}
													onComplianceCheck={
														manageable && seedanceComplianceAvailable
															? handleComplianceCheck
															: undefined
													}
													onMenuOpenChange={setCardMenuOpen}
													onEdit={handleEditAsset}
													onTransferOwner={(asset) =>
														setTransferAssets([asset])
													}
													onDelete={(item) =>
														void handleDeleteAsset(item)
													}
													onToggle={handleAssetToggle}
													onPreview={(asset) => {
														setPreviewResource(
															toAssetLibraryFullscreenPreviewItem(
																asset,
															),
														)
													}}
												/>
											)
										})}
									</div>
								)}
							</ScrollArea>

							<div className="flex shrink-0 items-center justify-between gap-4 border-t py-3 text-sm text-muted-foreground">
								<div className="flex min-w-0 items-center gap-3">
									{confirmError || (showSelectionCount && !showBatchActions) ? (
										<span
											className={cn(confirmError && "text-destructive")}
											role={confirmError ? "alert" : undefined}
										>
											{confirmError
												? t("assets.confirmFailed", "素材选择失败，请重试")
												: t("assets.selectedCount", {
														defaultValue:
															"已选择 {{count}} / {{max}} 项",
														count: selectedAssets.length,
														max: selectionLimit,
													})}
										</span>
									) : (
										<span />
									)}
								</div>
								<Button
									type="button"
									className="min-w-28"
									disabled={
										selectedAssets.length === 0 ||
										confirming ||
										batchActionPending
									}
									onClick={() => void handleConfirm()}
								>
									{confirming
										? t("assets.applying", "应用中...")
										: t("assets.apply", "应用至画布")}
								</Button>
							</div>
						</div>
					</div>
				</DialogContent>
			</Dialog>
			<AssetLibraryTransferOwnerDialog
				assets={transferAssets}
				t={t}
				onClose={() => setTransferAssets([])}
				onTransferred={(assetIds) => {
					const transferredIdSet = new Set(assetIds)
					setSelectedAssetIds((currentIds) =>
						currentIds.filter((assetId) => !transferredIdSet.has(assetId)),
					)
					refreshLibrary()
				}}
			/>
			{previewResource ? (
				<MediaResourceFullscreenPreview
					resource={previewResource}
					onClose={() => {
						suppressLibraryDismissRef.current = true
						window.setTimeout(() => {
							suppressLibraryDismissRef.current = false
						}, 0)
						setPreviewResource(null)
					}}
				/>
			) : null}
		</>
	)
}

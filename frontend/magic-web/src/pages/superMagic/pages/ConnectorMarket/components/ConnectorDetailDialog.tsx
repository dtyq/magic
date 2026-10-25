import { useEffect, useState, type AnimationEventHandler } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, X } from "lucide-react"
import { FlowApi } from "@/apis"
import MagicImage from "@/components/base/MagicImage"
import { Button } from "@/components/shadcn-ui/button"
import { Dialog, DialogContent } from "@/components/shadcn-ui/dialog"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { useOverlayZIndex } from "@/hooks/useOverlayZIndex"
import { IconMCP } from "@/enhance/tabler/icons-react"
import type { IMCPItem } from "@/components/Agent/MCP/types"
import { renderMarkdownLinks } from "@/components/Agent/MCP/renderMarkdownLinks"

interface ConnectorDetailDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	connector: IMCPItem | null
	selected?: boolean
	loading?: boolean
	onToggle?: (
		connector: IMCPItem,
		options?: {
			zIndex?: number
			onNestedPanelOpen?: () => void
			onNestedPanelClose?: () => void
			modalClassName?: string
			modalWidth?: number | string
			panelVariant?: "default" | "connector-market"
			panelMode?: "add" | "edit"
		},
	) => Promise<unknown> | void
}

type ConnectorDetail = IMCPItem & {
	offline?: boolean
	check_auth?: boolean
	check_require_fields?: boolean
	type?: string
}

export default function ConnectorDetailDialog({
	open,
	onOpenChange,
	connector,
	selected = false,
	loading = false,
	onToggle,
}: ConnectorDetailDialogProps) {
	const { t: tMarket } = useTranslation("crew/market")
	const overlayLayer = useOverlayZIndex({ open })
	const [detail, setDetail] = useState<ConnectorDetail | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [hasLoadFailed, setHasLoadFailed] = useState(false)
	const [isActionLoading, setIsActionLoading] = useState(false)
	const [isRemoving, setIsRemoving] = useState(false)
	const [selectedOnClose, setSelectedOnClose] = useState<boolean | null>(null)
	const [isNestedPanelOpen, setIsNestedPanelOpen] = useState(false)
	const [reloadNonce, setReloadNonce] = useState(0)
	const connectorId = connector?.id?.trim() || ""

	useEffect(() => {
		if (!open || !connectorId) return
		setIsRemoving(false)
		setSelectedOnClose(null)
		let disposed = false
		setIsLoading(true)
		setHasLoadFailed(false)
		setDetail(null)

		void FlowApi.getAvailableMCP([connectorId])
			.then((response) => {
				if (!disposed)
					setDetail((response?.list?.[0] as ConnectorDetail | undefined) ?? null)
			})
			.catch(() => {
				if (!disposed) setHasLoadFailed(true)
			})
			.finally(() => {
				if (!disposed) setIsLoading(false)
			})

		return () => {
			disposed = true
		}
	}, [connectorId, open, reloadNonce])
	const isSelected = open ? selected || isRemoving : (selectedOnClose ?? (selected || isRemoving))

	const displayDetail = detail ?? (connector as ConnectorDetail | null)
	const displayName = displayDetail?.name || tMarket("connectors.empty")
	const displayDescription =
		displayDetail?.description || tMarket("connectors.descriptionFallback")
	const displayDescriptionNodes = renderMarkdownLinks(displayDescription, {
		linkClassName: "text-primary underline underline-offset-2 hover:opacity-90",
		linkTestId: "connector-detail-description-link",
	})
	const requestClose = () => {
		if (isNestedPanelOpen) return
		setSelectedOnClose(selected || isRemoving)
		onOpenChange(false)
	}

	async function handleToggle() {
		if (!connector || loading || isActionLoading) return
		if (selected) setIsRemoving(true)
		setIsActionLoading(true)
		try {
			const didToggle = await onToggle?.(connector, {
				zIndex: overlayLayer.contentZIndex + 10,
				modalWidth: "calc(100% - 2rem)",
				modalClassName:
					"!max-h-[calc(100%-3rem)] !max-w-[560px] !overflow-hidden !rounded-xl !border !bg-background !p-0 !shadow-sm",
				onNestedPanelOpen: () => setIsNestedPanelOpen(true),
				onNestedPanelClose: () => setIsNestedPanelOpen(false),
			})
			if (didToggle !== false) {
				setSelectedOnClose(selected || isRemoving)
				onOpenChange(false)
			}
		} finally {
			setIsActionLoading(false)
		}
	}

	const handleContentAnimationEnd: AnimationEventHandler<HTMLDivElement> = (event) => {
		if (event.target === event.currentTarget && !open) overlayLayer.releaseOverlayZIndex()
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (nextOpen) onOpenChange(true)
				else requestClose()
			}}
		>
			<DialogContent
				showCloseButton={false}
				onEscapeKeyDown={(event) => event.stopPropagation()}
				overlayClassName="bg-black/50 backdrop-blur-sm"
				className="max-h-[calc(100%-3rem)] w-[calc(100%-2rem)] max-w-[680px] gap-0 overflow-hidden rounded-xl border bg-background p-0 shadow-sm"
				style={{ zIndex: overlayLayer.contentZIndex }}
				onAnimationEnd={handleContentAnimationEnd}
				data-testid="connector-detail-dialog"
			>
				<div className="flex h-full max-h-[90vh] w-full min-w-0 flex-col px-3 pb-3 pt-2">
					<div className="relative flex items-center justify-center pb-3">
						<div className="h-1 w-20 rounded-full bg-muted-foreground/30" />
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="absolute right-0 top-0 size-7 rounded-md text-muted-foreground"
							onClick={requestClose}
							data-testid="connector-detail-close-button"
						>
							<X className="size-4" aria-hidden />
						</Button>
					</div>

					{isLoading ? (
						<div
							className="flex flex-col gap-3 px-1 pb-1"
							data-testid="connector-detail-loading"
						>
							<div className="flex flex-col items-center gap-2 px-3 pt-2">
								<Skeleton className="size-24 rounded-2xl" />
								<Skeleton className="h-8 w-40" />
							</div>
							<Skeleton className="h-32 w-full rounded-xl" />
							<Skeleton className="h-10 w-full rounded-md" />
						</div>
					) : hasLoadFailed ? (
						<div className="flex flex-col items-center gap-3 py-8 text-center">
							<p className="text-sm text-muted-foreground">
								{tMarket("connectors.loadFailed")}
							</p>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setReloadNonce((value) => value + 1)}
							>
								{tMarket("connectors.retry")}
							</Button>
						</div>
					) : (
						<div
							className="flex min-h-0 flex-1 flex-col"
							data-testid="connector-detail-content"
						>
							<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 px-1 pb-1">
								<div className="flex min-w-0 flex-col items-center gap-2 px-3 pt-2">
									<MagicImage
										className="size-24 rounded-2xl"
										src={displayDetail?.icon}
										alt={displayName}
										fallback={
											<div className="size-24 overflow-hidden rounded-2xl">
												<IconMCP size="100%" />
											</div>
										}
									/>
									<h2 className="max-w-full break-words text-center text-2xl font-semibold leading-8 text-foreground">
										{displayName}
									</h2>
								</div>
								<div className="flex min-h-0 flex-1 flex-col gap-3">
									<div className="rounded-xl bg-secondary px-3 py-2.5">
										<p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
											{displayDescriptionNodes}
										</p>
									</div>
									{isSelected ? (
										<div className="flex items-center justify-end gap-2">
											<Button
												type="button"
												variant="destructive"
												className="h-10 w-full bg-destructive/10 text-destructive hover:bg-destructive/15"
												onClick={() => void handleToggle()}
												disabled={!connector || loading || isActionLoading}
												data-testid="connector-detail-remove-button"
											>
												{loading || isActionLoading ? (
													<Loader2 className="size-4 animate-spin" />
												) : (
													tMarket("connectors.remove")
												)}
											</Button>
										</div>
									) : (
										<Button
											type="button"
											variant="default"
											className="h-10 w-full shadow-xs"
											onClick={() => void handleToggle()}
											disabled={!connector || loading || isActionLoading}
											data-testid="connector-detail-toggle-button"
										>
											{loading || isActionLoading ? (
												<Loader2 className="size-4 animate-spin" />
											) : null}
											{!loading && !isActionLoading
												? tMarket("connectors.install")
												: null}
										</Button>
									)}
								</div>
							</div>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	)
}

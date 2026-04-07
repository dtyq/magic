import { useEffect, useMemo, useState } from "react"
import { Loader2, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import SmartTooltip from "@/components/other/SmartTooltip"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import { Dialog, DialogContent } from "@/components/shadcn-ui/dialog"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn-ui/tabs"
import { cn } from "@/lib/utils"
import {
	crewService,
	type AgentDetailView,
	type StoreAgentMarketDetailView,
} from "@/services/crew/CrewService"
import CrewFallbackAvatar from "./CrewFallbackAvatar"

interface CrewDetailDialogAction {
	label: string
	onClick: () => Promise<void> | void
	variant?: "default" | "destructive" | "secondary"
	disabled?: boolean
	testId: string
}

interface CrewDetailDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	agentCode: string | null
	detailSource?: "employee" | "market"
	versionCode?: string | null
	avatarUrl?: string | null
	primaryAction?: CrewDetailDialogAction
}

type CrewDetailTabValue = "skills" | "playbook"

export function CrewDetailDialog({
	open,
	onOpenChange,
	agentCode,
	detailSource = "employee",
	versionCode,
	avatarUrl,
	primaryAction,
}: CrewDetailDialogProps) {
	const { t } = useTranslation("crew/market")
	const { t: tCrewCreate } = useTranslation("crew/create")
	const [detail, setDetail] = useState<AgentDetailView | null>(null)
	const [marketDetail, setMarketDetail] = useState<StoreAgentMarketDetailView | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [hasLoadFailed, setHasLoadFailed] = useState(false)
	const [activeTab, setActiveTab] = useState<CrewDetailTabValue>("skills")
	const [isActionLoading, setIsActionLoading] = useState(false)
	const [avatarLoadFailed, setAvatarLoadFailed] = useState(false)
	const [reloadNonce, setReloadNonce] = useState(0)
	const normalizedAgentCode = agentCode?.trim() || ""

	const normalizedVersionLabel = useMemo(() => {
		const trimmed = versionCode?.trim() || marketDetail?.versionCode?.trim()
		if (!trimmed) return ""
		return trimmed.toUpperCase().startsWith("V") ? trimmed : `V${trimmed}`
	}, [marketDetail?.versionCode, versionCode])

	const displayName =
		detail?.name?.trim() ||
		marketDetail?.name?.trim() ||
		normalizedAgentCode ||
		t("detailDialog.emptyName")
	const displayRole =
		detail?.role?.trim() || marketDetail?.role?.trim() || t("detailDialog.emptyRole")
	const displayDescription =
		detail?.description?.trim() ||
		marketDetail?.description?.trim() ||
		tCrewCreate("noDescription")
	const displayAvatarUrl =
		avatarUrl?.trim() || detail?.icon?.trim() || marketDetail?.icon?.trim() || ""
	const showRemoteAvatar = Boolean(displayAvatarUrl) && !avatarLoadFailed
	const skills = detail?.skills ?? []
	const playbooks = detail?.features ?? []
	const shouldShowTabs = detail != null

	useEffect(() => {
		if (!open || !normalizedAgentCode) return

		let isDisposed = false
		setIsLoading(true)
		setHasLoadFailed(false)
		setActiveTab("skills")
		setDetail(null)
		setMarketDetail(null)

		const request =
			detailSource === "market"
				? crewService.getStoreAgentMarketDetail(normalizedAgentCode).then((nextDetail) => {
						if (isDisposed) return
						setMarketDetail(nextDetail)
					})
				: crewService.getAgentDetail(normalizedAgentCode).then((nextDetail) => {
						if (isDisposed) return
						setDetail(nextDetail)
					})

		void request
			.then(() => {
				if (isDisposed) return
				setHasLoadFailed(false)
			})
			.catch(() => {
				if (isDisposed) return
				setHasLoadFailed(true)
				magicToast.error(t("detailDialog.loadFailed"))
			})
			.finally(() => {
				if (isDisposed) return
				setIsLoading(false)
			})

		return () => {
			isDisposed = true
		}
	}, [detailSource, normalizedAgentCode, open, reloadNonce, t])

	useEffect(() => {
		setAvatarLoadFailed(false)
	}, [displayAvatarUrl])

	async function handlePrimaryAction() {
		if (!primaryAction || isActionLoading) return
		setIsActionLoading(true)
		try {
			await primaryAction.onClick()
			onOpenChange(false)
		} finally {
			setIsActionLoading(false)
		}
	}

	function handleRetryLoad() {
		setDetail(null)
		setHasLoadFailed(false)
		setReloadNonce((value) => value + 1)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton={false}
				overlayClassName="bg-black/50 backdrop-blur-sm"
				className="w-[calc(100%-2rem)] max-w-[360px] gap-0 overflow-hidden rounded-xl border bg-background p-0 shadow-sm"
				data-testid="crew-detail-dialog"
			>
				<div
					className="flex w-full flex-col px-3 pb-3 pt-2"
					data-testid="crew-detail-dialog-content"
				>
					<div className="relative flex items-center justify-center pb-3">
						<div
							className="h-1 w-20 rounded-full bg-muted-foreground/30"
							data-testid="crew-detail-dialog-handle"
						/>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="absolute right-0 top-0 size-7 rounded-md text-muted-foreground"
							onClick={() => onOpenChange(false)}
							data-testid="crew-detail-dialog-close-button"
						>
							<X className="size-4" aria-hidden />
						</Button>
					</div>

					{isLoading ? (
						<DetailDialogLoading />
					) : hasLoadFailed ? (
						<div
							className="flex flex-col items-center gap-3 py-6 text-center"
							data-testid="crew-detail-dialog-error"
						>
							<p className="text-sm text-muted-foreground">
								{t("detailDialog.loadFailed")}
							</p>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={handleRetryLoad}
								data-testid="crew-detail-dialog-retry-button"
							>
								{t("detailDialog.retry")}
							</Button>
						</div>
					) : (
						<>
							<div
								className="flex min-w-0 flex-col items-center gap-2"
								data-testid="crew-detail-dialog-header"
							>
								<div
									className="flex size-20 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-muted text-foreground shadow-sm"
									data-testid="crew-detail-dialog-avatar-wrap"
								>
									{showRemoteAvatar ? (
										<img
											src={displayAvatarUrl}
											alt=""
											className="size-full object-cover"
											loading="lazy"
											decoding="async"
											onError={() => setAvatarLoadFailed(true)}
										/>
									) : (
										<CrewFallbackAvatar />
									)}
								</div>
								<div className="flex w-full min-w-0 flex-col items-center gap-1">
									<h2
										className="max-w-full break-words text-center text-lg font-semibold leading-6 text-foreground"
										data-testid="crew-detail-dialog-title"
									>
										{displayName}
									</h2>
									<Badge
										variant="outline"
										className="min-w-0 max-w-full shrink justify-center overflow-hidden rounded-md px-2 py-0.5 text-xs font-normal"
										data-testid="crew-detail-dialog-role-badge"
									>
										<SmartTooltip
											elementType="span"
											className="inline-block max-w-[300px] text-center align-top text-xs font-normal leading-4"
											content={displayRole}
											sideOffset={4}
										>
											{displayRole}
										</SmartTooltip>
									</Badge>
									{normalizedVersionLabel ? (
										<Badge
											variant="outline"
											className="rounded-md px-2 py-0.5 text-xs font-semibold"
											data-testid="crew-detail-dialog-version-badge"
										>
											{normalizedVersionLabel}
										</Badge>
									) : null}
								</div>
							</div>

							<div
								className="mt-4 rounded-xl bg-muted px-4 py-3"
								data-testid="crew-detail-dialog-description"
							>
								<p className="break-words text-sm leading-6 text-muted-foreground">
									{displayDescription}
								</p>
							</div>

							{primaryAction ? (
								<Button
									type="button"
									variant={primaryAction.variant ?? "default"}
									className={cn(
										"mt-3 h-10 w-full shadow-xs",
										primaryAction.variant === "destructive" &&
											"text-xs font-medium leading-4 hover:opacity-90",
									)}
									style={
										primaryAction.variant === "destructive"
											? {
													color: "rgb(239 68 68)",
													backgroundImage:
														"linear-gradient(0deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.95)), linear-gradient(0deg, rgb(239, 68, 68), rgb(239, 68, 68))",
												}
											: undefined
									}
									onClick={handlePrimaryAction}
									disabled={isActionLoading || primaryAction.disabled}
									data-testid={primaryAction.testId}
								>
									{isActionLoading ? (
										<Loader2 className="size-4 animate-spin" aria-hidden />
									) : null}
									{primaryAction.label}
								</Button>
							) : null}

							{shouldShowTabs ? (
								<Tabs
									value={activeTab}
									onValueChange={(value) =>
										setActiveTab(value as CrewDetailTabValue)
									}
									className="mt-3 gap-3"
									data-testid="crew-detail-dialog-tabs"
								>
									<TabsList
										className="grid h-10 w-full grid-cols-2 rounded-lg bg-muted p-1"
										data-testid="crew-detail-dialog-tabs-list"
									>
										<TabsTrigger
											value="skills"
											data-testid="crew-detail-dialog-tab-skills"
										>
											{tCrewCreate("card.skills")}
										</TabsTrigger>
										<TabsTrigger
											value="playbook"
											data-testid="crew-detail-dialog-tab-playbook"
										>
											{tCrewCreate("playbook.title")}
										</TabsTrigger>
									</TabsList>
									<TabsContent
										value="skills"
										className="mt-0"
										data-testid="crew-detail-dialog-skills-panel"
									>
										<DialogList
											items={skills.map((skill) => ({
												id: skill.id,
												name: skill.name,
												description: skill.description,
											}))}
											emptyText={tCrewCreate("noSkills")}
											scope="skills"
										/>
									</TabsContent>
									<TabsContent
										value="playbook"
										className="mt-0"
										data-testid="crew-detail-dialog-playbook-panel"
									>
										<DialogList
											items={playbooks.map((playbook) => ({
												id: playbook.id,
												name: playbook.name,
												description:
													playbook.description?.trim() ||
													tCrewCreate("playbook.untitledDescription"),
											}))}
											emptyText={t("detailDialog.emptyPlaybook")}
											scope="playbook"
										/>
									</TabsContent>
								</Tabs>
							) : null}
						</>
					)}
				</div>
			</DialogContent>
		</Dialog>
	)
}

function DialogList({
	items,
	emptyText,
	scope,
}: {
	items: Array<{ id: string; name: string; description: string }>
	emptyText: string
	scope: "skills" | "playbook"
}) {
	if (!items.length) {
		return (
			<div
				className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-4 text-center text-sm text-muted-foreground"
				data-testid={`crew-detail-dialog-${scope}-empty`}
			>
				{emptyText}
			</div>
		)
	}

	return (
		<ScrollArea className="max-h-44 pr-1" data-testid={`crew-detail-dialog-${scope}-list`}>
			<div className="flex flex-col gap-2">
				{items.map((item) => (
					<div
						key={item.id}
						className="rounded-xl border border-border bg-background px-3 py-2"
						data-testid={`crew-detail-dialog-${scope}-item`}
					>
						<p className="break-words text-sm font-medium leading-5 text-foreground">
							{item.name}
						</p>
						<p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
							{item.description}
						</p>
					</div>
				))}
			</div>
		</ScrollArea>
	)
}

function DetailDialogLoading() {
	return (
		<div className="flex flex-col gap-3" data-testid="crew-detail-dialog-loading">
			<div className="flex flex-col items-center gap-2">
				<Skeleton className="size-20 rounded-full" />
				<Skeleton className="h-5 w-40" />
				<Skeleton className="h-5 w-28 rounded-md" />
				<Skeleton className="h-5 w-14 rounded-md" />
			</div>
			<Skeleton className="h-24 w-full rounded-xl" />
			<Skeleton className="h-10 w-full rounded-md" />
		</div>
	)
}

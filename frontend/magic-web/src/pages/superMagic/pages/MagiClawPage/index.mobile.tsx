import { useState } from "react"
import { useRequest } from "ahooks"
import {
	CirclePlus,
	Cloudy,
	Ellipsis,
	Loader2,
	MessageCircle,
	MessageCircleMore,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { MagicClawApi, type MagicClawItem } from "@/apis"
import avatarHighlight from "@/assets/resources/magi-claw/card-avatar-highlight.svg"
import { useConfirmDialog } from "@/components/shadcn-composed/confirm-dialog"
import { Button } from "@/components/shadcn-ui/button"
import { MagiClaw } from "@/enhance/lucide-react"
import heroLeft from "@/assets/resources/magi-claw/hero-left.webp"
import heroRight from "@/assets/resources/magi-claw/hero-right.webp"
import ActionsPopup, {
	type ActionButtonConfig,
} from "@/pages/superMagicMobile/components/ActionsPopup"
import { RouteName } from "@/routes/constants"
import { usePoppinsFont } from "@/styles/font"
import useGeistFont from "@/styles/fonts/geist"
import { MagiClawCreateDialog } from "./MagiClawCreateDialog"
import useNavigate from "@/routes/hooks/useNavigate"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"

const HERO_GRADIENT =
	"linear-gradient(90.87deg, rgb(255, 247, 247) 6.65%, rgb(238, 245, 255) 97.64%)"

function clawRowTestId(claw: MagicClawItem) {
	return claw.code || claw.id
}

export default function MagiClawMobilePage() {
	const { t } = useTranslation("sidebar")
	const clawBrandValues = getClawBrandTranslationValues()
	const navigate = useNavigate()
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
	const [isCreating, setIsCreating] = useState(false)
	const [selectedClaw, setSelectedClaw] = useState<MagicClawItem | null>(null)
	const [isActionsPopupOpen, setIsActionsPopupOpen] = useState(false)
	const { confirm, dialog } = useConfirmDialog()
	usePoppinsFont()
	useGeistFont()

	const {
		data: listPayload,
		loading: listLoading,
		error: listError,
		refresh: refreshClawList,
	} = useRequest(
		() =>
			MagicClawApi.queryMagicClawList(
				{ page: 1, page_size: 100 },
				{ enableErrorMessagePrompt: false },
			),
		{ refreshDeps: [] },
	)

	const claws = listPayload?.list ?? []
	const hasClaws = claws.length > 0

	function handleOpenClawPlayground(clawCode: string) {
		if (!clawCode) return
		navigate({
			name: RouteName.ClawPlayground,
			params: { code: clawCode },
		})
	}

	async function handleCreateClaw(name: string, icon?: string | null) {
		setIsCreating(true)
		try {
			const created = await MagicClawApi.createMagicClaw({
				name,
				...(icon ? { icon } : {}),
			})
			const projectId = created.extra?.project?.id
			if (!projectId) {
				toast.error(t("superLobster.created.createFailed", clawBrandValues))
				return
			}
			setIsCreateDialogOpen(false)
			void refreshClawList()
			handleOpenClawPlayground(created.code)
		} catch {
			toast.error(t("superLobster.created.createFailed", clawBrandValues))
		} finally {
			setIsCreating(false)
		}
	}

	function handleOpenCreate() {
		setIsCreateDialogOpen(true)
	}

	function buildClawDisplayName(claw: MagicClawItem) {
		return (
			claw.name ||
			claw.extra?.project?.project_name ||
			t("superLobster.workspace.untitledProject", clawBrandValues)
		)
	}

	function closeActionsPopup() {
		setIsActionsPopupOpen(false)
		setSelectedClaw(null)
	}

	function handleOpenActionsPopup(claw: MagicClawItem) {
		setSelectedClaw(claw)
		setIsActionsPopupOpen(true)
	}

	async function handleDeleteClaw(claw: MagicClawItem) {
		if (!claw.code) return

		try {
			await MagicClawApi.deleteMagicClaw({ code: claw.code })
			toast.success(t("superLobster.created.deleteSuccess", clawBrandValues))
			setSelectedClaw(null)
			void refreshClawList()
		} catch {
			toast.error(t("superLobster.created.deleteFailed", clawBrandValues))
		}
	}

	function handleConfirmDelete(claw: MagicClawItem) {
		closeActionsPopup()
		confirm({
			title: t("superLobster.created.deleteConfirmTitle", {
				...clawBrandValues,
				name: buildClawDisplayName(claw),
			}),
			description: t("superLobster.created.deleteConfirmDescription", clawBrandValues),
			confirmText: t("superLobster.created.delete", clawBrandValues),
			variant: "destructive",
			destructivePresentation: "soft",
			dialogSize: "sm",
			onConfirm: () => {
				void handleDeleteClaw(claw)
			},
		})
	}

	const actionButtonList: ActionButtonConfig[] = selectedClaw
		? [
				{
					key: "delete",
					label: t("superLobster.created.delete", clawBrandValues),
					variant: "danger",
					disabled: !selectedClaw.code,
					onClick: () => handleConfirmDelete(selectedClaw),
				},
			]
		: []

	const featureItems = [
		{
			key: "customization",
			icon: <MagiClaw className="size-5 shrink-0 text-foreground" aria-hidden />,
			title: t("superLobster.features.customization.title"),
			description: t("superLobster.features.customization.description", clawBrandValues),
		},
		{
			key: "deployment",
			icon: (
				<Cloudy
					className="size-5 shrink-0 text-foreground"
					strokeWidth={1.75}
					aria-hidden
				/>
			),
			title: t("superLobster.features.deployment.title"),
			description: t("superLobster.features.deployment.description", clawBrandValues),
		},
		{
			key: "connect",
			icon: (
				<MessageCircleMore
					className="size-5 shrink-0 text-foreground"
					strokeWidth={1.75}
					aria-hidden
				/>
			),
			title: t("superLobster.features.connect.title"),
			description: t("superLobster.features.connect.description", clawBrandValues),
		},
	]

	const listStateClassName =
		"flex min-h-[120px] flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card py-8 text-center"

	return (
		<>
			{dialog}
			<div
				className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-background pt-safe-top"
				data-testid="magi-claw-page-mobile"
			>
				<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2 pt-2">
					<div
						className="relative h-20 w-full shrink-0 overflow-hidden rounded-lg"
						style={{ backgroundImage: HERO_GRADIENT }}
						data-testid="magi-claw-mobile-hero"
					>
						<div
							className="pointer-events-none absolute -left-12 -top-2 flex h-[135px] w-[148px] items-center justify-center"
							aria-hidden
						>
							<div className="flex-none rotate-[170.87deg] -scale-y-100">
								<div className="relative h-[116px] w-[132px]">
									<img
										src={heroLeft}
										alt=""
										className="pointer-events-none absolute inset-0 size-full max-w-none object-cover"
									/>
								</div>
							</div>
						</div>
						<div
							className="pointer-events-none absolute -right-[93px] -top-[65px] flex size-[227px] items-center justify-center"
							aria-hidden
						>
							<div className="flex-none rotate-[-33.64deg]">
								<div className="relative size-[164px]">
									<img
										src={heroRight}
										alt=""
										className="pointer-events-none absolute inset-0 size-full max-w-none object-cover"
									/>
								</div>
							</div>
						</div>
						<div className="relative z-10 flex h-full flex-col items-center justify-center gap-0.5 px-4 text-center">
							<div className="flex items-center gap-0.5 whitespace-nowrap text-xl tracking-[-0.4px]">
								<span className="font-['Poppins'] font-semibold text-foreground">
									{t("superLobster.heroLead", clawBrandValues)}
								</span>
								<span className="font-['Poppins'] font-black text-red-500">
									{t("superLobster.titleAccent", clawBrandValues)}
								</span>
							</div>
							<p className="text-xs leading-4 text-muted-foreground">
								{t("superLobster.description", clawBrandValues)}
							</p>
						</div>
					</div>

					{listLoading ? (
						<div
							className={listStateClassName}
							data-testid="magi-claw-mobile-list-loading"
						>
							<Loader2
								className="size-5 animate-spin text-muted-foreground"
								aria-hidden
							/>
							<p className="text-sm text-muted-foreground">
								{t("superLobster.created.listLoading", clawBrandValues)}
							</p>
						</div>
					) : listError ? (
						<div
							className={listStateClassName}
							data-testid="magi-claw-mobile-list-error"
						>
							<p className="text-sm text-muted-foreground">
								{t("superLobster.created.listLoadFailed", clawBrandValues)}
							</p>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="w-fit"
								data-testid="magi-claw-mobile-list-retry"
								onClick={() => void refreshClawList()}
							>
								{t("superLobster.created.listRetry", clawBrandValues)}
							</Button>
						</div>
					) : hasClaws ? (
						<div
							className="flex w-full flex-col gap-2"
							data-testid="magi-claw-mobile-list-section"
						>
							<div className="flex w-full items-center justify-between gap-2">
								<p className="text-base font-medium leading-6 text-foreground">
									{t("superLobster.mobile.mySuperClaw", clawBrandValues)}
								</p>
								<Button
									type="button"
									className="h-8 gap-2 rounded-md px-3 text-xs font-medium shadow-xs"
									onClick={handleOpenCreate}
									data-testid="magi-claw-mobile-section-create"
								>
									<CirclePlus className="size-4" aria-hidden />
									{t("superLobster.created.create", clawBrandValues)}
								</Button>
							</div>
							<div
								className="flex flex-col gap-2"
								data-testid="magi-claw-mobile-created-list"
							>
								{claws.map((claw) => {
									const rowId = clawRowTestId(claw)
									const displayName = buildClawDisplayName(claw)
									const avatarSrc = claw.icon_file_url || avatarHighlight

									return (
										<div
											key={rowId}
											className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
											data-testid={`magi-claw-mobile-item-${rowId}`}
										>
											<div className="relative size-8 shrink-0 overflow-hidden rounded-full border border-border bg-background">
												<img
													src={avatarSrc}
													alt=""
													className="pointer-events-none size-full object-cover"
												/>
											</div>
											<div className="min-w-0 flex-1">
												<p className="truncate text-sm font-medium leading-none text-foreground">
													{displayName}
												</p>
											</div>
											<div className="flex shrink-0 items-center gap-2">
												<Button
													type="button"
													variant="outline"
													size="icon"
													className="size-8 rounded-md shadow-xs"
													aria-label={t(
														"superLobster.mobile.moreActions",
														clawBrandValues,
													)}
													data-testid={`magi-claw-mobile-item-more-${rowId}`}
													onClick={() => handleOpenActionsPopup(claw)}
												>
													<Ellipsis className="size-4" aria-hidden />
												</Button>
												<Button
													type="button"
													variant="outline"
													className="h-8 gap-2 rounded-md px-3 text-xs font-medium shadow-xs"
													data-testid={`magi-claw-mobile-item-chat-${rowId}`}
													disabled={!claw.code}
													onClick={() => {
														if (claw.code)
															handleOpenClawPlayground(claw.code)
													}}
												>
													<MessageCircle className="size-4" aria-hidden />
													{t(
														"superLobster.created.chat",
														clawBrandValues,
													)}
												</Button>
											</div>
										</div>
									)
								})}
							</div>
						</div>
					) : (
						<div className="flex w-full flex-col gap-1">
							<div className="flex w-full items-center justify-between">
								<p className="text-base font-medium leading-6 text-foreground">
									{t("superLobster.getStarted")}
								</p>
							</div>

							<div
								className="flex w-full flex-col items-center gap-3 overflow-hidden rounded-lg border border-border bg-card p-4"
								data-testid="magi-claw-mobile-get-started-card"
							>
								<div className="relative size-16 shrink-0 overflow-hidden rounded-full border border-border bg-background">
									<img
										src={heroLeft}
										alt=""
										className="absolute inset-0 size-full scale-125 object-cover object-center"
									/>
								</div>
								<div className="flex w-full flex-col gap-2 text-center text-sm leading-none">
									<p className="font-medium text-foreground">
										{t("superLobster.card.title", clawBrandValues)}
									</p>
									<p className="font-normal text-muted-foreground">
										{t("superLobster.card.description", clawBrandValues)}
									</p>
								</div>
								<Button
									className="h-9 w-full gap-2 shadow-xs"
									onClick={handleOpenCreate}
									data-testid="magi-claw-mobile-create-cta"
								>
									<CirclePlus className="size-4" aria-hidden />
									{t("superLobster.created.create", clawBrandValues)}
								</Button>
							</div>
						</div>
					)}

					<div className="flex w-full flex-col gap-4 px-2.5 pb-8 pt-2.5">
						{featureItems.map((item) => (
							<div
								key={item.key}
								className="flex gap-2"
								data-testid={`magi-claw-mobile-feature-${item.key}`}
							>
								{item.icon}
								<div className="flex min-w-0 flex-1 flex-col gap-1">
									<h2 className="text-sm font-medium leading-5 text-foreground">
										{item.title}
									</h2>
									<p className="text-xs leading-4 text-muted-foreground">
										{item.description}
									</p>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>

			<ActionsPopup
				visible={isActionsPopupOpen}
				title={t("superLobster.mobile.moreActions", clawBrandValues)}
				actions={actionButtonList}
				onClose={closeActionsPopup}
			/>
			<MagiClawCreateDialog
				open={isCreateDialogOpen}
				onOpenChange={setIsCreateDialogOpen}
				onCreate={(name, icon) => void handleCreateClaw(name, icon)}
				isSubmitting={isCreating}
			/>
		</>
	)
}

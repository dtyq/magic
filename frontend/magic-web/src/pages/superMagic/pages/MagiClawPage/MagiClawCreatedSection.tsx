import { CirclePlus, Ellipsis, Loader2, MessageCircle, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import avatarHighlight from "@/assets/resources/magi-claw/card-avatar-highlight.svg"
import { MagicClawApi, type MagicClawItem } from "@/apis"
import MagicDropdown from "@/components/base/MagicDropdown"
import { useConfirmDialog } from "@/components/shadcn-composed/confirm-dialog"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"

interface MagiClawCreatedSectionProps {
	claws: MagicClawItem[]
	listLoading: boolean
	listError?: Error
	onRefreshList: () => void
	onOpenCreate: () => void
	onOpenClawPlayground: (clawCode: string) => void
}

function clawRowTestId(claw: MagicClawItem) {
	return claw.code || claw.id
}

const centeredListStateClassName =
	"flex min-h-[240px] flex-col items-center justify-center py-8 text-center"

export function MagiClawCreatedSection({
	claws,
	listLoading,
	listError,
	onRefreshList,
	onOpenCreate,
	onOpenClawPlayground,
}: MagiClawCreatedSectionProps) {
	const { t } = useTranslation("sidebar")
	const clawBrandValues = getClawBrandTranslationValues()
	const { confirm, dialog } = useConfirmDialog()

	function buildClawDisplayName(claw: MagicClawItem) {
		return (
			claw.name ||
			claw.extra?.project?.project_name ||
			t("superLobster.workspace.untitledProject", clawBrandValues)
		)
	}

	async function handleDeleteClaw(claw: MagicClawItem) {
		if (!claw.code) return

		try {
			await MagicClawApi.deleteMagicClaw({ code: claw.code })
			toast.success(t("superLobster.created.deleteSuccess", clawBrandValues))
			void onRefreshList()
		} catch {
			toast.error(t("superLobster.created.deleteFailed", clawBrandValues))
		}
	}

	function handleConfirmDelete(claw: MagicClawItem) {
		const displayName = buildClawDisplayName(claw)
		confirm({
			title: t("superLobster.created.deleteConfirmTitle", {
				...clawBrandValues,
				name: displayName,
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

	return (
		<>
			{dialog}
			<section className="flex flex-col gap-3 px-2.5" data-testid="magi-claw-created-section">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h2 className="text-base font-medium leading-6 text-foreground">
						{t("superLobster.created.title", clawBrandValues)}
					</h2>

					<div className="flex items-center gap-2">
						{/* <Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-8 gap-1 px-3 text-xs font-normal text-foreground"
							data-testid="magi-claw-user-guide-button"
						>
							<BookOpen className="size-4" />
							{t("superLobster.created.userGuide")}
						</Button> */}
						<Button
							type="button"
							className="h-9 gap-2 rounded-md px-4 text-sm font-medium shadow-xs"
							data-testid="magi-claw-create-button"
							onClick={onOpenCreate}
						>
							<CirclePlus className="size-4" />
							{t("superLobster.created.create", clawBrandValues)}
						</Button>
					</div>
				</div>

				<div className="flex flex-col gap-2" data-testid="magi-claw-created-list">
					{listLoading ? (
						<div className={cn(centeredListStateClassName, "gap-3")}>
							<Loader2
								className="size-5 animate-spin text-muted-foreground"
								aria-hidden
							/>
							<p
								className="text-sm text-muted-foreground"
								data-testid="magi-claw-list-loading"
							>
								{t("superLobster.created.listLoading", clawBrandValues)}
							</p>
						</div>
					) : listError ? (
						<div className={cn(centeredListStateClassName, "gap-3")}>
							<p
								className="text-sm text-muted-foreground"
								data-testid="magi-claw-list-error"
							>
								{t("superLobster.created.listLoadFailed", clawBrandValues)}
							</p>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="w-fit"
								data-testid="magi-claw-list-retry-button"
								onClick={() => void onRefreshList()}
							>
								{t("superLobster.created.listRetry", clawBrandValues)}
							</Button>
						</div>
					) : claws.length === 0 ? (
						<p
							className="px-1 text-sm text-muted-foreground"
							data-testid="magi-claw-list-empty"
						>
							{t("superLobster.created.listEmpty", clawBrandValues)}
						</p>
					) : (
						claws.map((claw) => {
							const rowId = clawRowTestId(claw)
							const clawCode = claw.code
							const displayName = buildClawDisplayName(claw)
							const avatarSrc = claw.icon_file_url || avatarHighlight

							return (
								<div
									key={rowId}
									className="flex items-center gap-3 overflow-hidden rounded-[10px] bg-sidebar px-4 py-3"
									data-testid={`magi-claw-created-item-${rowId}`}
								>
									<div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-background">
										<img
											alt=""
											aria-hidden
											className="pointer-events-none size-full object-cover"
											src={avatarSrc}
										/>
									</div>

									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium leading-none text-foreground">
											{displayName}
										</p>
									</div>

									<div className="flex items-center gap-2">
										<MagicDropdown
											menu={{
												items: [
													{
														key: "delete",
														label: t(
															"superLobster.created.delete",
															clawBrandValues,
														),
														danger: true,
														icon: (
															<Trash2
																className="size-4"
																aria-hidden
															/>
														),
														onClick: () => handleConfirmDelete(claw),
													},
												],
											}}
											placement="bottomRight"
											overlayClassName="min-w-[140px]"
										>
											<span>
												<Button
													type="button"
													variant="outline"
													size="icon"
													className="size-9 rounded-md bg-background"
													data-testid={`magi-claw-created-item-more-button-${rowId}`}
													aria-label={t(
														"superLobster.mobile.moreActions",
														clawBrandValues,
													)}
												>
													<Ellipsis className="size-4" aria-hidden />
												</Button>
											</span>
										</MagicDropdown>
										<Button
											type="button"
											variant="outline"
											className="h-9 rounded-md bg-background px-4 text-sm font-medium"
											data-testid={`magi-claw-created-item-chat-button-${rowId}`}
											disabled={!clawCode}
											onClick={() => {
												if (clawCode) onOpenClawPlayground(clawCode)
											}}
										>
											<MessageCircle className="size-4" />
											{t("superLobster.created.chat", clawBrandValues)}
										</Button>
									</div>
								</div>
							)
						})
					)}
				</div>
			</section>
		</>
	)
}

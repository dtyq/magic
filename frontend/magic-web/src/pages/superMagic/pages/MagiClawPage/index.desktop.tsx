import { useMemo, useState } from "react"
import { useRequest } from "ahooks"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { MagicClawApi } from "@/apis"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { usePoppinsFont } from "@/styles/font"
import useGeistFont from "@/styles/fonts/geist"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"
import { useNamedPageTitle } from "@/pages/superMagic/hooks/useNamedPageTitle"
import { MagiClawCreatedSection } from "./MagiClawCreatedSection"
import { MagiClawCreateDialog, type MagiClawCreatePayload } from "./MagiClawCreateDialog"
import { EMPTY_MAGIC_CLAW_LIST, MAGI_CLAW_LIST_POLLING_INTERVAL } from "./constants"
import { MagiClawFeatures } from "./MagiClawFeatures"
import { MagiClawHeader } from "./MagiClawHeader"
import { MagiClawHero } from "./MagiClawHero"

export default function MagiClawDesktopPage() {
	const { t } = useTranslation("sidebar")
	const clawBrandValues = getClawBrandTranslationValues()
	const navigate = useNavigate()
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
	const [isCreating, setIsCreating] = useState(false)
	usePoppinsFont()
	useGeistFont()
	useNamedPageTitle({
		pageTitle: t("superLobster.title", clawBrandValues),
	})

	const {
		data: listPayload,
		loading: listLoading,
		error: listError,
		refresh: refreshClawList,
		refreshAsync: refreshClawListAsync,
	} = useRequest(
		() =>
			MagicClawApi.queryMagicClawList(
				{ page: 1, page_size: 100 },
				{ enableErrorMessagePrompt: false },
			),
		{
			refreshDeps: [],
			pollingInterval: MAGI_CLAW_LIST_POLLING_INTERVAL,
			pollingWhenHidden: false,
		},
	)

	const hasLoadedClawList = typeof listPayload !== "undefined"
	const visibleListLoading = listLoading && !hasLoadedClawList
	const visibleListError = hasLoadedClawList ? undefined : listError
	const claws = useMemo(() => listPayload?.list ?? EMPTY_MAGIC_CLAW_LIST, [listPayload])

	function handleOpenClawPlayground(clawCode: string) {
		if (!clawCode) return
		navigate({
			name: RouteName.ClawPlayground,
			params: { code: clawCode },
		})
	}

	async function handleCreateClaw({ name, icon, template_code }: MagiClawCreatePayload) {
		setIsCreating(true)
		try {
			const created = await MagicClawApi.createMagicClaw({
				name,
				template_code,
				...(icon ? { icon } : {}),
			})
			if (!created.code) {
				toast.error(t("superLobster.created.createFailed", clawBrandValues))
				return
			}
			setIsCreateDialogOpen(false)
			void refreshClawList()
			handleOpenClawPlayground(created.code)
		} catch {
			// toast.error(t("superLobster.created.createFailed", clawBrandValues))
		} finally {
			setIsCreating(false)
		}
	}

	return (
		<>
			<div
				className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xs"
				data-testid="magi-claw-page"
			>
				<MagiClawHeader className="shrink-0" />
				<ScrollArea className="min-h-0 flex-1 [&_[data-slot='scroll-area-viewport']>div]:!block">
					<div className="mx-auto flex w-full min-w-0 max-w-[896px] flex-col gap-6 px-4 py-10 md:px-6 md:py-20">
						<MagiClawHero />
						<MagiClawCreatedSection
							claws={claws}
							listLoading={visibleListLoading}
							isRefreshingList={listLoading}
							listError={visibleListError}
							onRefreshList={refreshClawListAsync}
							onOpenCreate={() => setIsCreateDialogOpen(true)}
							onOpenClawPlayground={handleOpenClawPlayground}
						/>
						<MagiClawFeatures />
					</div>
				</ScrollArea>
			</div>

			<MagiClawCreateDialog
				open={isCreateDialogOpen}
				onOpenChange={setIsCreateDialogOpen}
				onCreate={(payload) => void handleCreateClaw(payload)}
				isSubmitting={isCreating}
			/>
		</>
	)
}

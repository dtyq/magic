import { useState } from "react"
import { useRequest } from "ahooks"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { MagicClawApi } from "@/apis"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { usePoppinsFont } from "@/styles/font"
import useGeistFont from "@/styles/fonts/geist"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"
import { MagiClawCreatedSection } from "./MagiClawCreatedSection"
import { MagiClawCreateDialog } from "./MagiClawCreateDialog"
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

	return (
		<>
			<div
				className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-border bg-background"
				data-testid="magi-claw-page"
			>
				<MagiClawHeader className="shrink-0" />
				<div className="flex min-h-0 flex-1 justify-center overflow-auto px-4 py-10 md:px-6 md:py-20">
					<div className="flex w-full max-w-[896px] flex-col gap-6">
						<MagiClawHero />
						<MagiClawFeatures />
						<MagiClawCreatedSection
							claws={claws}
							listLoading={listLoading}
							listError={listError}
							onRefreshList={refreshClawList}
							onOpenCreate={() => setIsCreateDialogOpen(true)}
							onOpenClawPlayground={handleOpenClawPlayground}
						/>
					</div>
				</div>
			</div>

			<MagiClawCreateDialog
				open={isCreateDialogOpen}
				onOpenChange={setIsCreateDialogOpen}
				onCreate={(name, icon) => void handleCreateClaw(name, icon)}
				isSubmitting={isCreating}
			/>
		</>
	)
}

import { ChevronDown, MessageCircle, SquarePen } from "lucide-react"
import { useTranslation } from "react-i18next"
import { SmoothTabs } from "@/components/shadcn-ui/smooth-tabs"
import type { Workspace } from "@/pages/superMagic/pages/Workspace/types"

export type MobileHomeMode = "chat" | "task"

export default function MobileHomeModeControls({
	mode,
	onModeChange,
	workspace,
	loading,
	error,
	busy,
	onChooseWorkspace,
}: {
	mode: MobileHomeMode
	onModeChange: (mode: MobileHomeMode) => void
	workspace: Workspace | null
	loading: boolean
	error: boolean
	busy: boolean
	onChooseWorkspace: () => void
}) {
	const { t } = useTranslation("super/mainInput")
	const { t: tSuper } = useTranslation("super")
	return (
		<fieldset
			disabled={busy}
			className="mt-6 flex w-full min-w-0 flex-col items-center gap-3"
			aria-label={t("homeMode.label")}
			data-testid="mobile-home-mode-controls"
		>
			<SmoothTabs<MobileHomeMode>
				data-testid="mobile-home-mode-tabs"
				tabs={[
					{
						value: "chat",
						label: t("homeMode.chat"),
						icon: <MessageCircle className="size-4" />,
						"data-testid": "mobile-home-mode-chat-tab",
					},
					{
						value: "task",
						label: t("homeMode.task"),
						icon: <SquarePen className="size-4" />,
						"data-testid": "mobile-home-mode-task-tab",
					},
				]}
				value={mode}
				onChange={onModeChange}
				variant="background"
				className="h-14 w-64 rounded-full bg-muted p-1.5"
				// Keep inactive tabs transparent after switching; keyboard users still get the focus ring.
				buttonClassName="h-11 gap-2 rounded-full text-base font-medium focus-visible:ring-1 focus-visible:ring-ring"
				indicatorClassName="inset-y-1.5 h-11 rounded-full"
				enableHoverBackground={false}
			/>
			{/* Reserve the destination row in both modes so the hero and input stay in place. */}
			<div className="flex h-10 w-full min-w-0 justify-center">
				{mode === "task" && (
					<button
						type="button"
						onClick={onChooseWorkspace}
						className="flex max-w-full items-center gap-1 rounded-lg px-3 text-sm text-muted-foreground hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
						data-testid="mobile-home-workspace"
					>
						<span className="truncate">
							{workspace
								? t("mobileHome.destination", {
										name:
											workspace.name || tSuper("workspace.unnamedWorkspace"),
									})
								: loading
									? t("mobileHome.loading")
									: error
										? t("mobileHome.workspaceUnavailable")
										: t("mobileHome.chooseWorkspace")}
						</span>
						<ChevronDown className="size-4 shrink-0" />
					</button>
				)}
			</div>
		</fieldset>
	)
}

import { MessageCircle, SquarePen } from "lucide-react"
import { useTranslation } from "react-i18next"
import { matchPath, useLocation } from "react-router"
import { SmoothTabs } from "@/components/shadcn-ui/smooth-tabs"
import { RoutePath } from "@/constants/routes"
import { useNavigateToSuperHome } from "@/layouts/BaseLayout/components/MagicSidebar/hooks/useNavigateToSuperHome"
import { RouteName } from "@/routes/constants"
import useNavigate from "@/routes/hooks/useNavigate"

export default function HomeModeTabs() {
	const { t } = useTranslation("super/mainInput")
	const { pathname } = useLocation()
	const navigate = useNavigate()
	const { navigateToSuperHome } = useNavigateToSuperHome()
	const isChatHome = Boolean(matchPath(`/:clusterCode${RoutePath.SuperChatHome}`, pathname))
	const isTaskHome = [RoutePath.Super, RoutePath.SuperWorkspaceState].some((path) =>
		matchPath(`/:clusterCode${path}`, pathname),
	)

	// The input container is shared with other scenes; only the two creation homes show tabs.
	if (!isChatHome && !isTaskHome) return null
	const activeMode = isChatHome ? "chat" : "task"

	return (
		<div role="group" aria-label={t("homeMode.label")}>
			<SmoothTabs<"chat" | "task">
				tabs={[
					{
						value: "chat",
						label: t("homeMode.chat"),
						icon: <MessageCircle className="size-4" />,
					},
					{
						value: "task",
						label: t("homeMode.task"),
						icon: <SquarePen className="size-4" />,
					},
				]}
				value={activeMode}
				onChange={(value) => {
					if (value === activeMode) return
					// Reuse sidebar navigation so task workspace restoration stays identical.
					if (value === "task") navigateToSuperHome()
					else navigate({ name: RouteName.SuperChatHome, viewTransition: false })
				}}
				variant="background"
				className="h-14 w-64 rounded-full bg-muted p-1.5"
				buttonClassName="h-11 gap-2 rounded-full text-base font-medium focus-visible:bg-sidebar-accent focus-visible:ring-1 focus-visible:ring-ring"
				indicatorClassName="inset-y-1.5 h-11 rounded-full"
			/>
		</div>
	)
}

import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import type { AgentResourceScope } from "../../utils/resourceProjects"

export function AgentResourceScopeSwitch({
	value,
	onChange,
}: {
	value: AgentResourceScope
	onChange: (scope: AgentResourceScope) => void
}) {
	const { t } = useTranslation("super")
	return (
		<div
			role="group"
			aria-label={t("selectPathModal.agentSource")}
			className="flex shrink-0 flex-wrap gap-1 border-b px-3 py-2"
		>
			<Button
				size="sm"
				variant={value === "created" ? "secondary" : "ghost"}
				aria-pressed={value === "created"}
				onClick={() => onChange("created")}
			>
				{t("selectPathModal.createdAgents")}
			</Button>
			<Button
				size="sm"
				variant={value === "collaborated" ? "secondary" : "ghost"}
				aria-pressed={value === "collaborated"}
				onClick={() => onChange("collaborated")}
			>
				{t("selectPathModal.collaboratedAgents")}
			</Button>
		</div>
	)
}

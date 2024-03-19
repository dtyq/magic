import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import { ExternalLink } from "lucide-react"
import { getRoutePath } from "@/opensource/routes/history/helpers"
import { RouteName } from "@/opensource/routes/constants"
import { useAddModelStore } from "./context"

const CONFIG_ROUTE_NAMES: Record<"llm" | "vlm", RouteName> = {
	llm: RouteName.AdminAIModel,
	vlm: RouteName.AdminAIDrawing,
}

function ConfigBanner() {
	const { t } = useTranslation("super")
	const store = useAddModelStore()
	const routeName = CONFIG_ROUTE_NAMES[store.category]
	const href = routeName ? (getRoutePath({ name: routeName }) ?? undefined) : undefined

	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className="shadow-xs flex h-9 w-full cursor-pointer items-center justify-between bg-secondary px-4 py-2 transition-colors hover:bg-secondary/80"
			data-testid="add-model-config-banner"
		>
			<span className="text-sm font-normal leading-5 text-secondary-foreground">
				{t("messageEditor.addModel.configBanner")}
			</span>
			<ExternalLink size={16} className="shrink-0 text-secondary-foreground" />
		</a>
	)
}

export default observer(ConfigBanner)

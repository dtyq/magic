import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import { ExternalLink } from "lucide-react"
import { getRoutePath } from "@/routes/history/helpers"
import { RouteName } from "@/routes/constants"
import type { ServiceProviderCategory } from "@/apis/modules/org-ai-model-provider"
import { useAddModelStore } from "./context"

const CONFIG_ROUTE_NAMES: Partial<Record<ServiceProviderCategory, RouteName>> = {
	llm: RouteName.AdminAIModel,
	vlm: RouteName.AdminAIDrawing,
}

const CONFIG_ROUTE_PATHS: Partial<Record<ServiceProviderCategory, string>> = {
	vgm: "/admin/ai/custom/video",
}

function ConfigBanner() {
	const { t } = useTranslation("super")
	const store = useAddModelStore()
	const routeName = CONFIG_ROUTE_NAMES[store.category]
	const href = routeName
		? (getRoutePath({ name: routeName }) ?? undefined)
		: CONFIG_ROUTE_PATHS[store.category]
	if (!href) return null

	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className="flex h-9 w-full cursor-pointer items-center justify-between bg-secondary px-4 py-2 shadow-xs transition-colors hover:bg-secondary/80"
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

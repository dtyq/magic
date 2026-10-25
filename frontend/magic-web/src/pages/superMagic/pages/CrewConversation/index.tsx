import { FileAccessProvider } from "@/pages/superMagic/providers/FileAccessProvider"
import { lazy, Suspense } from "react"
import { Loader2 } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useLocation, useParams } from "react-router-dom"
import { useIsMobile } from "@/hooks/useIsMobile"
import { CrewConversationStoreProvider } from "./context"
import { getCrewConversationLayout, getCrewConversationRouteOrganizationCode } from "./route-layout"
import { useCrewConversationOrganizationGuard } from "./hooks/useCrewConversationOrganizationGuard"
import CrewStateView from "./components/CrewStateView"
import { defaultClusterCode } from "@/routes/helpers"
import { useMagicWidgetConfig } from "@/providers/MagicWidgetProvider"
import type { MagicWidgetConfig } from "@/providers/MagicWidgetProvider/types"

const CrewConversationDesktop = lazy(() => import("./index.desktop"))
const CrewConversationMobile = lazy(() => import("./index.mobile"))

interface CrewConversationLayoutContentProps {
	layout: "desktop" | "mobile"
	widgetContext: {
		instanceId: string
		hostOrigin: string
		renderMode?: "inline" | "floating"
	} | null
	widgetConfig: MagicWidgetConfig
}

/** Renders the selected Crew content layout without subscribing to viewport changes. */
function CrewConversationLayoutContent({
	layout,
	widgetContext,
	widgetConfig,
}: CrewConversationLayoutContentProps) {
	return (
		<Suspense
			fallback={
				<div className="flex h-full w-full items-center justify-center bg-background">
					<Loader2 className="size-8 animate-spin text-muted-foreground" />
				</div>
			}
		>
			{layout === "mobile" ? (
				<CrewConversationMobile widgetContext={widgetContext} />
			) : (
				<CrewConversationDesktop
					widgetContext={widgetContext}
					widgetConfig={widgetConfig}
				/>
			)}
		</Suspense>
	)
}

interface ResponsiveCrewConversationLayoutProps {
	search: string
	widgetContext: CrewConversationLayoutContentProps["widgetContext"]
	widgetConfig: CrewConversationLayoutContentProps["widgetConfig"]
}

/** Preserves viewport and legacy-query layout detection when Widget layout is unspecified. */
function ResponsiveCrewConversationLayout({
	search,
	widgetContext,
	widgetConfig,
}: ResponsiveCrewConversationLayoutProps) {
	const isMobile = useIsMobile()
	const layout = getCrewConversationLayout({
		isMobileViewport: isMobile,
		search,
	})
	return (
		<CrewConversationLayoutContent
			layout={layout}
			widgetContext={widgetContext}
			widgetConfig={widgetConfig}
		/>
	)
}

/** Selects explicit Widget layout without installing the responsive viewport subscription. */
function CrewConversationPage() {
	const { code, clusterCode } = useParams<{ code?: string; clusterCode?: string }>()
	const { search } = useLocation()
	const { config, embedContext } = useMagicWidgetConfig()
	const routeOrganizationCode = getCrewConversationRouteOrganizationCode(search)
	const widgetContext = embedContext
		? {
				instanceId: embedContext.instanceId,
				hostOrigin: embedContext.hostOrigin,
				renderMode: embedContext.renderMode,
			}
		: null
	// The route deployment is resolved before the organization guard runs, so organization
	// switching cannot select an account from another SaaS or private environment.
	const organizationGuard = useCrewConversationOrganizationGuard(
		routeOrganizationCode,
		clusterCode ?? defaultClusterCode,
	)

	if (!organizationGuard.isReady) {
		return <CrewStateView status={organizationGuard.status === "error" ? "error" : "loading"} />
	}

	return (
		<CrewConversationStoreProvider
			code={code}
			autoHire={embedContext ? config.conversation?.autoHire !== false : undefined}
		>
			{embedContext && config.layout ? (
				<CrewConversationLayoutContent
					layout={config.layout}
					widgetContext={widgetContext}
					widgetConfig={config}
				/>
			) : (
				<ResponsiveCrewConversationLayout
					search={search}
					widgetContext={widgetContext}
					widgetConfig={config}
				/>
			)}
		</CrewConversationStoreProvider>
	)
}

const ObservedPage = observer(CrewConversationPage)

export default function FileAccessPage() {
	return (
		<FileAccessProvider>
			<ObservedPage />
		</FileAccessProvider>
	)
}

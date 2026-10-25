import { lazy, type PropsWithChildren } from "react"
import type { RouteObject } from "react-router"
import { RoutePath } from "@/constants/routes"
import { RouteName } from "@/routes/constants"
import { isPersonaResearchEnabled } from "@/services/personaResearchFeature"

const PersonaResearchLayout = lazy(() => import("@/pages/superMagic/pages/PersonaResearch"))
const ResearchHomePage = lazy(
	() => import("@/pages/superMagic/pages/PersonaResearch/pages/ResearchHomePage"),
)
const ResearchStudioPage = lazy(
	() => import("@/pages/superMagic/pages/PersonaResearch/pages/ResearchStudioPage"),
)
const PersonaLibraryPage = lazy(
	() => import("@/pages/superMagic/pages/PersonaResearch/pages/PersonaLibraryPage"),
)
const ReportTemplatesPage = lazy(
	() => import("@/pages/superMagic/pages/PersonaResearch/pages/ReportTemplatesPage"),
)
const ResearchStudiesPage = lazy(
	() => import("@/pages/superMagic/pages/PersonaResearch/pages/ResearchStudiesPage"),
)
const NotFound = lazy(() => import("@/pages/exception/not-found"))

function PersonaResearchRoute({ children }: PropsWithChildren) {
	// Keep disabled paths matched so generic "/super/:projectId" routes cannot capture them.
	return isPersonaResearchEnabled() ? children : <NotFound />
}

/**
 * AI research routes. Children use absolute paths so route names resolve to real URLs;
 * the static "research" segment ranks above "/super/:projectId/:topicId".
 */
export const superMagicPersonaResearchRoutes: RouteObject[] = [
	{
		path: `/:clusterCode${RoutePath.PersonaResearch}`,
		element: (
			<PersonaResearchRoute>
				<PersonaResearchLayout />
			</PersonaResearchRoute>
		),
		children: [
			{
				name: RouteName.PersonaResearch,
				path: `/:clusterCode${RoutePath.PersonaResearch}`,
				element: <ResearchHomePage />,
				meta: { title: "routes.personaResearch" },
			},
			{
				name: RouteName.PersonaResearchPersonas,
				path: `/:clusterCode${RoutePath.PersonaResearchPersonas}`,
				element: <PersonaLibraryPage />,
				meta: { title: "routes.personaResearch" },
			},
			{
				name: RouteName.PersonaResearchTemplates,
				path: `/:clusterCode${RoutePath.PersonaResearchTemplates}`,
				element: <ReportTemplatesPage />,
				meta: { title: "routes.personaResearch" },
			},
			{
				name: RouteName.PersonaResearchStudies,
				path: `/:clusterCode${RoutePath.PersonaResearchStudies}`,
				element: <ResearchStudiesPage />,
				meta: { title: "routes.personaResearch" },
			},
			{
				name: RouteName.PersonaResearchStudy,
				path: `/:clusterCode${RoutePath.PersonaResearchStudy}`,
				element: <ResearchStudioPage />,
				meta: { title: "routes.personaResearch" },
			},
		],
	},
]

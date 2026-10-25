import { lazy } from "react"
import { Navigate } from "react-router-dom"
import {
	RouteGroup,
	RouteName,
	RoutePath,
	RouteRedirectPath,
	RouteSection,
} from "@magic-admin-v2/constants/routes"
import type { Route } from "@magic-admin-v2/routes/types"
import { editionDevelopmentRoutes } from "@magic-admin-v2/standalone/routes/edition-development"

const ExampleCardGridPage = lazy(
	() => import("@magic-admin-v2/features/ui-examples/example-card-grid-page"),
)
const ExampleDashboardPage = lazy(
	() => import("@magic-admin-v2/features/ui-examples/example-dashboard-page"),
)
const ExampleDetailEditPage = lazy(
	() => import("@magic-admin-v2/features/ui-examples/example-detail-edit-page"),
)
const ExampleDetailPage = lazy(
	() => import("@magic-admin-v2/features/ui-examples/example-detail-page"),
)
const ExampleDialogFormPage = lazy(
	() => import("@magic-admin-v2/features/ui-examples/example-dialog-form-page"),
)
const ExampleEmptyStatePage = lazy(
	() => import("@magic-admin-v2/features/ui-examples/example-empty-state-page"),
)
const ExampleListPage = lazy(() => import("@magic-admin-v2/features/ui-examples/example-list-page"))
const ExampleMultiColumnFormPage = lazy(
	() => import("@magic-admin-v2/features/ui-examples/example-multi-column-form-page"),
)
const ExampleSettingsPage = lazy(
	() => import("@magic-admin-v2/features/ui-examples/example-settings-page"),
)
const ExampleSheetDetailPage = lazy(
	() => import("@magic-admin-v2/features/ui-examples/example-sheet-detail-page"),
)
const ExampleSingleColumnFormPage = lazy(
	() => import("@magic-admin-v2/features/ui-examples/example-single-column-form-page"),
)
const ExampleWizardPage = lazy(
	() => import("@magic-admin-v2/features/ui-examples/example-wizard-page"),
)

const baseDevelopmentRoutes: Route[] = [
	{
		name: RouteName.ExamplesDashboard,
		path: RoutePath.ExamplesDashboard,
		element: <ExampleDashboardPage />,
		titleKey: "nav.item.exampleDashboard",
		meta: { section: RouteSection.Examples, group: RouteGroup.ExampleDashboard },
	},
	{
		name: RouteName.ExamplesList,
		path: RoutePath.ExamplesList,
		element: <ExampleListPage />,
		titleKey: "nav.item.exampleList",
		meta: { section: RouteSection.Examples, group: RouteGroup.ExampleData },
	},
	{
		name: RouteName.ExamplesCards,
		path: RoutePath.ExamplesCards,
		element: <ExampleCardGridPage />,
		titleKey: "nav.item.exampleCards",
		meta: { section: RouteSection.Examples, group: RouteGroup.ExampleData },
	},
	{
		name: RouteName.ExamplesForm,
		path: RoutePath.ExamplesForm,
		element: <Navigate to={RouteRedirectPath.ExamplesFormSingle} replace />,
	},
	{
		name: RouteName.ExamplesFormSingle,
		path: RoutePath.ExamplesFormSingle,
		element: <ExampleSingleColumnFormPage />,
		titleKey: "nav.item.exampleFormSingle",
		meta: { section: RouteSection.Examples, group: RouteGroup.ExampleForms },
	},
	{
		name: RouteName.ExamplesFormMulti,
		path: RoutePath.ExamplesFormMulti,
		element: <ExampleMultiColumnFormPage />,
		titleKey: "nav.item.exampleFormMulti",
		meta: { section: RouteSection.Examples, group: RouteGroup.ExampleForms },
	},
	{
		name: RouteName.ExamplesSettings,
		path: RoutePath.ExamplesSettings,
		element: <ExampleSettingsPage />,
		titleKey: "nav.item.exampleSettings",
		meta: { section: RouteSection.Examples, group: RouteGroup.ExampleSettings },
	},
	{
		name: RouteName.ExamplesDetail,
		path: RoutePath.ExamplesDetail,
		element: <ExampleDetailPage />,
		titleKey: "nav.item.exampleDetail",
		meta: { section: RouteSection.Examples, group: RouteGroup.ExampleDetails },
	},
	{
		name: RouteName.ExamplesDetailEdit,
		path: RoutePath.ExamplesDetailEdit,
		element: <ExampleDetailEditPage />,
		titleKey: "nav.item.exampleDetailEdit",
		meta: { section: RouteSection.Examples, group: RouteGroup.ExampleDetails },
	},
	{
		name: RouteName.ExamplesEmpty,
		path: RoutePath.ExamplesEmpty,
		element: <ExampleEmptyStatePage />,
		titleKey: "nav.item.exampleEmpty",
		meta: { section: RouteSection.Examples, group: RouteGroup.ExampleStates },
	},
	{
		name: RouteName.ExamplesWizard,
		path: RoutePath.ExamplesWizard,
		element: <ExampleWizardPage />,
		titleKey: "nav.item.exampleWizard",
		meta: { section: RouteSection.Examples, group: RouteGroup.ExampleForms },
	},
	{
		name: RouteName.ExamplesDialog,
		path: RoutePath.ExamplesDialog,
		element: <ExampleDialogFormPage />,
		titleKey: "nav.item.exampleDialogForm",
		meta: { section: RouteSection.Examples, group: RouteGroup.ExampleForms },
	},
	{
		name: RouteName.ExamplesSheet,
		path: RoutePath.ExamplesSheet,
		element: <ExampleSheetDetailPage />,
		titleKey: "nav.item.exampleSheetDetail",
		meta: { section: RouteSection.Examples, group: RouteGroup.ExampleDetails },
	},
]

export const developmentRoutes: readonly Route[] = [
	...editionDevelopmentRoutes,
	...baseDevelopmentRoutes,
]

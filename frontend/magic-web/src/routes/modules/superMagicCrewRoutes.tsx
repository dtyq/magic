import { lazy } from "react"
import type { RouteObject } from "react-router"
import { RoutePath } from "@/constants/routes"
import { RouteName } from "@/routes/constants"

/**
 * @description 路由处理器，需要异步渲染，等待路由生成再渲染再执行对应业务流程
 */
const Navigate = lazy(() => import("@/routes/components/Navigate"))

/** Crew Market - 员工市场 */
const CrewMarketPage = lazy(() => import("@/pages/superMagic/pages/CrewMarket"))
/** Skill Market - 技能市场 */
const SkillMarketPage = lazy(() => import("@/pages/superMagic/pages/SkillMarket"))
/** Crew Edit - 编辑 Crew */
const CrewEditPage = lazy(() => import("@/pages/superMagic/pages/CrewEdit/index.desktop"))
/** My Skills - 我的技能 */
const MySkillsPage = lazy(() => import("@/pages/superMagic/pages/MySkillsPage"))
/** Skill Edit - 编辑 Skill */
const SkillEditPage = lazy(() => import("@/pages/superMagic/pages/SkillEdit"))
/** My Crew - 我的员工 */
const MyCrewPage = lazy(() => import("@/pages/superMagic/pages/MyCrewPage"))

export const superMagicCrewRoutes = [
	{
		name: RouteName.CrewMarket,
		path: `/:clusterCode${RoutePath.CrewMarket}`,
		element: <Navigate name={RouteName.CrewMarketCrew} replace />,
	},
	{
		name: RouteName.CrewMarketCrew,
		path: `/:clusterCode${RoutePath.CrewMarketCrew}`,
		element: <CrewMarketPage />,
	},
	{
		name: RouteName.CrewMarketSkills,
		path: `/:clusterCode${RoutePath.CrewMarketSkills}`,
		element: <SkillMarketPage />,
	},
	{
		name: RouteName.CrewEdit,
		path: `/:clusterCode${RoutePath.CrewEdit}`,
		element: <CrewEditPage />,
	},
	{
		name: RouteName.MySkills,
		path: `/:clusterCode${RoutePath.MySkills}`,
		element: <MySkillsPage />,
	},
	{
		name: RouteName.SkillEdit,
		path: `/:clusterCode${RoutePath.SkillEdit}`,
		element: <SkillEditPage />,
	},
	{
		name: RouteName.MyCrew,
		path: `/:clusterCode${RoutePath.MyCrew}`,
		element: <MyCrewPage />,
	},
] as Array<RouteObject>

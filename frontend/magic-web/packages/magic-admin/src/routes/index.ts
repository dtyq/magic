import { useRoutes } from "react-router-dom"
import { routes, otherRoutes } from "./routes"

export default function AppRoutes() {
	return useRoutes(routes)
}

export { routes, otherRoutes }
export type { Route } from "./routes"

import { useRoutes } from "react-router"
import { registerRoutes } from "./routes"

const routes = registerRoutes()

export function AppRoutes() {
	return useRoutes(routes)
}

export * from "./history"

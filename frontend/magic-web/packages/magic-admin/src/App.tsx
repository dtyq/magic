import { useEffect } from "react"
import { MagicSuspense } from "../components"
import { useAdmin } from "./provider/AdminProvider"
import AppRoutes from "./routes"
import { createI18nNext } from "./locales/creator"

export const i18nInstance = createI18nNext("zh_CN")

function App() {
	const { language } = useAdmin()

	useEffect(() => {
		i18nInstance?.changeLanguage?.(language)
	}, [language])

	return (
		<MagicSuspense style={{ height: "100vh", width: "100vw" }}>
			<AppRoutes />
		</MagicSuspense>
	)
}

export default App

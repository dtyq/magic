import useNavigate, { MagicNavigateParams } from "../hooks/useNavigate"
import { useEffect } from "react"
import { convertSearchParams, routesMatch } from "@/routes/history/helpers"

export default function Navigate(props: MagicNavigateParams): null {
	const navigate = useNavigate()
	useEffect(() => {
		const url = new URL(window.location.href)
		const matchesRoute = routesMatch(url.pathname)
		navigate({
			...props,
			params: {
				...(props?.params || {}),
				...(matchesRoute?.params || {}),
			},
			query: {
				...(props?.query || {}),
				...convertSearchParams(url.searchParams),
			},
		})
	}, [])

	return null
}

export { Navigate }

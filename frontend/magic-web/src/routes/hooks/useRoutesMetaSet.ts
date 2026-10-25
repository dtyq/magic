import { useEffect, useMemo } from "react"
import { useLocation, matchRoutes } from "react-router"
import type { MagicIndexRouteObject, MetaData } from "react-router"
import { useTranslation } from "react-i18next"
import { registerRoutes } from "@/routes/routes"
import { useMainTranslation } from "@/hooks/i18n/useMainTranslation"

const routes = registerRoutes({ isPersonalOrganization: false })

export default function useMetaSet() {
	const { pathname } = useLocation()
	const { t: tMain } = useMainTranslation("common")
	const { t: tAdmin } = useTranslation("admin/common")

	const matchesRoutes = useMemo(() => {
		return matchRoutes(routes, pathname)
	}, [pathname])

	const route = matchesRoutes?.[matchesRoutes.length - 1]?.route as
		(MagicIndexRouteObject & { title?: string }) | undefined
	const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/")

	function setMeta(metaInfo?: MetaData) {
		const { title, keywords, description } = metaInfo || {}

		function getDom(name: string): Element {
			const dom = document.querySelector(`meta[name=${name}]`)
			if (dom) {
				return dom
			} else {
				const meta = document.createElement("meta")
				meta.setAttribute("name", name)
				document.head.append(meta)
				return meta
			}
		}

		if (title) {
			document.title = `${tMain(title)} - ${tMain("meta.title")}`
		} else {
			document.title = tMain("meta.title")
		}

		if (tMain("meta.keywords")) {
			const dom = getDom("keywords")
			const str = keywords ? `${keywords},${tMain("meta.keywords")}` : tMain("meta.keywords")
			dom?.setAttribute("content", str)
		} else if (keywords) {
			const dom = getDom("keywords")
			dom?.setAttribute("content", keywords)
		}

		if (tMain("meta.description")) {
			const dom = getDom("description")
			const str = description
				? `${description},${tMain("meta.description")}`
				: tMain("meta.description")
			dom?.setAttribute("content", str)
		} else if (description) {
			const dom = getDom("description")
			dom?.setAttribute("content", description)
		}
	}

	useEffect(() => {
		// Apply static route metadata first; admin sidebar titles are the fallback when meta.title is absent.
		// Routes without either value are left alone so dynamic project titles are preserved.
		if (route?.meta?.title) {
			setMeta(route.meta)
		} else if (isAdminRoute && route?.title) {
			setMeta({
				...route.meta,
				title: tAdmin(route.title, { defaultValue: tMain(route.title) }),
			})
		}
	}, [isAdminRoute, route?.meta, route?.title, tAdmin, tMain])

	return { setMeta } // 返回设置方法交由业务层作做进一步元信息设置
}

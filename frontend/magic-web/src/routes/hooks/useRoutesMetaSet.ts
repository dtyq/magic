import { useEffect, useMemo } from "react"
import { useLocation, matchRoutes } from "react-router"
import type { MagicIndexRouteObject, MetaData } from "react-router"
import { registerRoutes } from "@/routes/routes"
import { useTranslation } from "react-i18next"

const routes = registerRoutes({ isPersonalOrganization: false })

export default function useMetaSet() {
	const { pathname } = useLocation()
	const { t } = useTranslation("common")

	const matchesRoutes = useMemo(() => {
		return matchRoutes(routes, pathname)
	}, [pathname])

	const route = matchesRoutes?.[matchesRoutes?.length - 1]?.route as MagicIndexRouteObject

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
			document.title = `${t(title)} - ${t("meta.title")}`
		} else {
			document.title = t("meta.title")
		}

		if (t("meta.keywords")) {
			const dom = getDom("keywords")
			const str = keywords ? `${keywords},${t("meta.keywords")}` : t("meta.keywords")
			dom?.setAttribute("content", str)
		} else if (keywords) {
			const dom = getDom("keywords")
			dom?.setAttribute("content", keywords)
		}

		if (t("meta.description")) {
			const dom = getDom("description")
			const str = description
				? `${description},${t("meta.description")}`
				: t("meta.description")
			dom?.setAttribute("content", str)
		} else if (description) {
			const dom = getDom("description")
			dom?.setAttribute("content", description)
		}
	}

	useEffect(() => {
		/** 设置对应内容 setMeta(meta) */
		setMeta(route?.meta)
	}, [route?.meta, t])

	return { setMeta } // 返回设置方法交由业务层作做进一步元信息设置
}

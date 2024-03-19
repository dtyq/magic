import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import { useEffect, useState } from "react"
import { useDeepCompareEffect } from "ahooks"
import { type TourProps } from "antd"
import { useUserInfo } from "@/opensource/models/user/hooks"
import { platformKey } from "@/opensource/utils/storage"
import { useTranslation } from "react-i18next"

interface UseGuideTourProps {
	isMobile: boolean
}

const HTMLGuideTourElementId = {
	AIOptimizationButton: "tour-ai-optimization-button",
	HTMLFileEditButton: "tour-html-file-edit-button",
	HTMLFileDownloadButton: "tour-html-file-download-button",
}

const getHTMLGuideTourLocalStorageKey = (userMagicId?: string) => {
	return platformKey(`super_magic/is_need_HTML_features_guide/${userMagicId || "unknown"}`)
}

const setNeedHTMLGuideTour = (userMagicId?: string) => {
	localStorage.setItem(getHTMLGuideTourLocalStorageKey(userMagicId), "true")
}

const useHTMLGuideTour = ({ isMobile }: UseGuideTourProps) => {
	const { t } = useTranslation("super/guideTour")
	const { userInfo } = useUserInfo()

	const [guideTourOpen, setGuideTourOpen] = useState(false)
	const [guideTourSteps, setGuideTourSteps] = useState<TourProps["steps"]>([])

	const [htmlGuideTourElementReady, setHtmlGuideTourElementReady] = useState({
		[HTMLGuideTourElementId.AIOptimizationButton]: false,
		[HTMLGuideTourElementId.HTMLFileEditButton]: false,
	})
	const [htmlGuideTourCount, setHtmlGuideTourCount] = useState(0)

	useDeepCompareEffect(() => {
		const localStorageKey = getHTMLGuideTourLocalStorageKey(userInfo?.magic_id)

		/** 是否需要HTML功能引导 */
		const isNeedHTMLFeaturesGuide = localStorage.getItem(localStorageKey) === "true"

		// 移动端不显示引导
		if (
			!isNeedHTMLFeaturesGuide ||
			isMobile ||
			Object.values(htmlGuideTourElementReady).some((value) => !value)
		) {
			return
		}

		localStorage.setItem(localStorageKey, "false")
		setTimeout(() => {
			// 第一次打开HTML文件的引导
			const steps: TourProps["steps"] = [
				{
					title: t("html.aiOptimization.title"),
					description: t("html.aiOptimization.description"),
					target:
						document.getElementById(HTMLGuideTourElementId.AIOptimizationButton) ||
						null,
				},
				{
					title: t("html.manualEdit.title"),
					description: t("html.manualEdit.description"),
					target:
						document.getElementById(HTMLGuideTourElementId.HTMLFileEditButton) || null,
				},
				{
					title: t("html.export.title"),
					description: t("html.export.description"),
					target:
						document.getElementById(HTMLGuideTourElementId.HTMLFileDownloadButton) ||
						null,
				},
			]
			setGuideTourSteps(steps)
			setGuideTourOpen(true)
		}, 1000)
	}, [htmlGuideTourElementReady, htmlGuideTourCount])

	// 监听HTML元素准备状态
	useEffect(() => {
		const handleElementReady = (element: string) => {
			if (element in htmlGuideTourElementReady) {
				setHtmlGuideTourElementReady((prev) => ({
					...prev,
					[element]: true,
				}))
				setHtmlGuideTourCount((prev) => prev + 1)
			}
		}

		pubsub.subscribe(PubSubEvents.GuideTourHTMLElementReady, handleElementReady)

		return () => {
			pubsub.unsubscribe(PubSubEvents.GuideTourHTMLElementReady, handleElementReady)
		}
	}, [])

	return {
		guideTourOpen,
		setGuideTourOpen,
		guideTourSteps,
	}
}

export { useHTMLGuideTour, HTMLGuideTourElementId, setNeedHTMLGuideTour }

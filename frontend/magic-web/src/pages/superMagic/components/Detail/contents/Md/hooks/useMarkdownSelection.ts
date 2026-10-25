import {
	createFileReferenceMention,
	type FileReferenceSource,
} from "@/components/business/MentionPanel/utils/fileReferenceMention"
import magicToast from "@/components/base/MagicToaster/utils"
import { useUserInfo, useOrganization } from "@/models/user/hooks"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { INSPECTOR_DETAIL_TYPE } from "@/pages/superMagic/components/MessageEditor/extensions/inspector-detail/const"
import {
	getMarkdownSelectionTarget,
	readMarkdownSelection,
	type MarkdownSourceSnapshot,
} from "../components/EditorBody/source-location"

interface MarkdownSelectionOptions {
	enabled: boolean
	snapshot: MarkdownSourceSnapshot | null
	fileId?: string
	file?: FileReferenceSource
	fileName?: string
	filePath?: string
	topicId?: string
	projectId?: string
}

export function useMarkdownSelection({
	enabled,
	snapshot,
	file,
	fileId,
	fileName,
	filePath,
	topicId,
	projectId,
}: MarkdownSelectionOptions) {
	const { t } = useTranslation("super")
	const { userInfo } = useUserInfo()
	const { organizationCode } = useOrganization()
	const [root, setRoot] = useState<HTMLDivElement | null>(null)
	const [active, setActive] = useState(false)
	const activeRef = useRef(false)
	const stop = useCallback(() => {
		activeRef.current = false
		setActive(false)
	}, [])
	const canSelect =
		enabled && !!snapshot?.content && !!fileId && !!fileName && filePath !== undefined
	const toggle = useMemoizedFn(() => {
		if (!canSelect) return
		activeRef.current = !activeRef.current
		setActive(activeRef.current)
	})

	useLayoutEffect(stop, [
		stop,
		enabled,
		snapshot,
		fileId,
		filePath,
		topicId,
		projectId,
		userInfo?.magic_id,
		organizationCode,
	])
	useEffect(() => {
		if (!active || !canSelect || !root || !snapshot || !fileId || !fileName) return
		const frame = document.createElement("div")
		frame.className =
			"pointer-events-none absolute z-popup rounded-sm border-2 border-primary bg-primary/10"
		frame.hidden = true
		root.append(frame)
		let target: ReturnType<typeof getMarkdownSelectionTarget> = null
		let animationFrame = 0
		const update = () => {
			animationFrame = 0
			if (!target?.element.isConnected || !root.contains(target.element)) {
				frame.hidden = true
				if (target) resizeObserver.unobserve(target.element)
				target = null
				return
			}
			const rect = target.element.getBoundingClientRect()
			const rootRect = root.getBoundingClientRect()
			const scaleX = root.offsetWidth ? rootRect.width / root.offsetWidth : 1
			const scaleY = root.offsetHeight ? rootRect.height / root.offsetHeight : 1
			frame.hidden = false
			Object.assign(frame.style, {
				left: `${(rect.left - rootRect.left) / scaleX + root.scrollLeft - root.clientLeft}px`,
				top: `${(rect.top - rootRect.top) / scaleY + root.scrollTop - root.clientTop}px`,
				width: `${rect.width / scaleX}px`,
				height: `${rect.height / scaleY}px`,
			})
		}
		const schedule = () => {
			if (!animationFrame) animationFrame = requestAnimationFrame(update)
		}
		const resizeObserver = new ResizeObserver(schedule)
		resizeObserver.observe(root)
		const move = (event: MouseEvent) => {
			const nextTarget = getMarkdownSelectionTarget(root, event.target)
			if (target?.element !== nextTarget?.element) {
				if (target) resizeObserver.unobserve(target.element)
				if (nextTarget) resizeObserver.observe(nextTarget.element)
			}
			target = nextTarget
			schedule()
		}
		const leave = () => {
			if (target) resizeObserver.unobserve(target.element)
			target = null
			frame.hidden = true
		}
		const preventPointerSelection = (event: PointerEvent) => {
			if (event.button !== 0) return
			event.preventDefault()
			event.stopImmediatePropagation()
		}
		let request: AbortController | null = null
		const click = async (event: MouseEvent) => {
			if (!activeRef.current) return
			event.preventDefault()
			event.stopImmediatePropagation()
			const selection = getMarkdownSelectionTarget(root, event.target)
			if (!selection) return
			const source = readMarkdownSelection(
				root,
				selection.element,
				selection.located,
				snapshot,
			)
			if (!source) return
			// 沿用文件所属空间的引用解析；切换预览或退出选取后取消旧请求。
			request?.abort()
			const controller = new AbortController()
			request = controller
			try {
				// 文件详情可能只有 ID／名称；预览已解析的同一文件路径仍须补入引用。
				const fileMention = await createFileReferenceMention(
					{
						...file,
						file_id: file?.file_id || fileId,
						file_name: file?.file_name || fileName,
						relative_file_path: file?.relative_file_path || filePath,
						project_id: file?.project_id ?? projectId,
						file_extension: file?.file_extension || fileName.split(".").pop() || "",
					},
					undefined,
					controller.signal,
				)
				if (controller.signal.aborted || !activeRef.current) return
				if (!fileMention) {
					magicToast.error(t("common.fileNotFoundOrLoadFailed"))
					return
				}
				pubsub.publish(PubSubEvents.Append_Content_To_Editor, {
					type: "doc",
					content: [
						{
							type: "paragraph",
							content: [
								{
									type: INSPECTOR_DETAIL_TYPE,
									attrs: {
										sourceType: "markdown",
										markdownSource: source,
										title: t("stylePanel.inspector.selectionDetails"),
										selector: "",
										tagName: selection.element.tagName.toLowerCase(),
										size: "",
										computedStyles: "{}",
										styleCount: 0,
										textContent: Array.from(
											source.targetText.replace(/\s+/g, " "),
										)
											.slice(0, 60)
											.join(""),
										fileMention,
									},
								},
							],
						},
					],
				})
				stop()
			} catch {
				if (!controller.signal.aborted && activeRef.current)
					magicToast.error(t("common.fileNotFoundOrLoadFailed"))
			}
		}
		const escape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault()
				stop()
			}
		}
		const observer = new MutationObserver(schedule)
		observer.observe(root, { childList: true, subtree: true })
		root.addEventListener("mousemove", move)
		root.addEventListener("mouseleave", leave)
		root.addEventListener("pointerdown", preventPointerSelection, true)
		root.addEventListener("click", click, true)
		window.addEventListener("scroll", schedule, true)
		window.addEventListener("resize", schedule)
		window.addEventListener("keydown", escape)
		return () => {
			request?.abort()
			cancelAnimationFrame(animationFrame)
			observer.disconnect()
			resizeObserver.disconnect()
			frame.remove()
			root.removeEventListener("mousemove", move)
			root.removeEventListener("mouseleave", leave)
			root.removeEventListener("pointerdown", preventPointerSelection, true)
			root.removeEventListener("click", click, true)
			window.removeEventListener("scroll", schedule, true)
			window.removeEventListener("resize", schedule)
			window.removeEventListener("keydown", escape)
		}
	}, [active, canSelect, root, snapshot, file, fileId, fileName, filePath, projectId, stop, t])

	return { active: active && canSelect, canSelect, toggle, stop, selectionRootRef: setRoot }
}

import { PlusIcon, X } from "lucide-react"
import {
	Fragment,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode,
	type RefCallback,
} from "react"
import ReferenceImageThumbnailImage from "../ReferenceImageThumbnailImage"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"
import { usePortalContainer } from "../ui/custom/PortalContainerContext"
import styles from "./SourceList.module.css"
import { cn } from "../../lib/utils"

/** 素材槽位：空槽为「+ 标签」；已配置时由列表内置铺满缩略图与 hover 删除 */
export interface SourceListSlotOption {
	kind: "slot"
	label: string
	secondaryLabel?: string
	value: string
	slotIndex: number
	/** 可选分组：供业务层传递资源类别，列表本身不展示分组标题 */
	groupId?: string
	/** 已选资源路径，有值时渲染缩略图 + hover 删除，不再使用默认「+」内容 */
	resourcePath?: string
	resourceFileName?: string
	onRemoveResource?: () => void
	/** 删除按钮无障碍标签 */
	removeResourceAriaLabel?: string
}

/**
 * 叠在列表区域几何中心，不占 flex 文档流；内容由 `render` 完全自定义（如圆形图标按钮）。
 * 多个 overlay 按顺序叠在同一锚点上，由调用方控制层级与内容。
 */
export interface SourceListOverlayOption {
	kind: "overlay"
	value: string
	render: () => ReactNode
}

export type SourceListOption = SourceListSlotOption | SourceListOverlayOption

export function isSourceListSlotOption(entry: SourceListOption): entry is SourceListSlotOption {
	return entry.kind === "slot"
}

export function isSourceListOverlayOption(
	entry: SourceListOption,
): entry is SourceListOverlayOption {
	return entry.kind === "overlay"
}

export interface SourceListRenderItemParams {
	option: SourceListSlotOption
	index: number
	className: string
	style: CSSProperties
	content: ReactNode
	/** 有 overlay 且需按槽位定位时，由列表传入并挂到槽位根节点（用于测量两槽中点） */
	slotRootRef?: RefCallback<HTMLDivElement | null>
}

interface SourceListProps {
	options?: SourceListOption[]
	className?: string
	style?: CSSProperties
	renderItem?: (params: SourceListRenderItemParams) => ReactNode
}

/** 视频/图片编辑器顶部素材槽位列表（首帧 / 尾帧 / 参考素材等） */
export default function SourceList(props: SourceListProps) {
	const { className, style, options, renderItem } = props
	const portalContainer = usePortalContainer()

	const entries = options ?? []
	const slotEntries = entries.filter(isSourceListSlotOption)
	const overlayEntries = entries.filter(isSourceListOverlayOption)
	const slotCount = slotEntries.length
	const measureOverlayBetweenFirstTwoSlots = overlayEntries.length > 0 && slotCount >= 2

	const listRef = useRef<HTMLDivElement | null>(null)
	const slotElRefs = useRef<(HTMLDivElement | null)[]>([])
	const [overlayPos, setOverlayPos] = useState<{ x: number; y: number } | null>(null)

	const updateOverlayBetweenSlots = useCallback(() => {
		if (!measureOverlayBetweenFirstTwoSlots) {
			setOverlayPos(null)
			return
		}
		const list = listRef.current
		const a = slotElRefs.current[0]
		const b = slotElRefs.current[1]
		if (!list || !a || !b) return
		const lr = list.getBoundingClientRect()
		const ar = a.getBoundingClientRect()
		const br = b.getBoundingClientRect()
		const midX = (ar.left + ar.width / 2 + br.left + br.width / 2) / 2 - lr.left
		const midY = (ar.top + ar.height / 2 + br.top + br.height / 2) / 2 - lr.top
		setOverlayPos({ x: midX, y: midY })
	}, [measureOverlayBetweenFirstTwoSlots])

	useLayoutEffect(() => {
		updateOverlayBetweenSlots()
		let raf2 = 0
		const raf1 = requestAnimationFrame(() => {
			raf2 = requestAnimationFrame(updateOverlayBetweenSlots)
		})
		const t = window.setTimeout(updateOverlayBetweenSlots, 320)
		return () => {
			cancelAnimationFrame(raf1)
			cancelAnimationFrame(raf2)
			window.clearTimeout(t)
		}
	}, [updateOverlayBetweenSlots, slotCount, overlayEntries.length])

	useEffect(() => {
		if (!measureOverlayBetweenFirstTwoSlots) return
		const ro = new ResizeObserver(() => updateOverlayBetweenSlots())
		const list = listRef.current
		if (list) ro.observe(list)
		const observeSlots = () => {
			const a = slotElRefs.current[0]
			const b = slotElRefs.current[1]
			if (a) ro.observe(a)
			if (b) ro.observe(b)
		}
		observeSlots()
		queueMicrotask(observeSlots)
		window.addEventListener("resize", updateOverlayBetweenSlots)
		return () => {
			ro.disconnect()
			window.removeEventListener("resize", updateOverlayBetweenSlots)
		}
	}, [measureOverlayBetweenFirstTwoSlots, updateOverlayBetweenSlots])

	let slotOrdinal = 0
	return (
		<div className={cn(styles.root, className)} style={style} data-video-editor-source-list="">
			<div ref={listRef} className={styles.sourceList}>
				{slotEntries.map((entry) => {
					const slotIndexInList = slotOrdinal
					slotOrdinal += 1
					const slotRootRef: RefCallback<HTMLDivElement | null> | undefined =
						measureOverlayBetweenFirstTwoSlots && slotIndexInList <= 1
							? (el) => {
									slotElRefs.current[slotIndexInList] = el
								}
							: undefined
					const emptySlotContent = (
						<>
							<PlusIcon size={16} />
							<span className={styles.sourceItemLabel}>
								<span>{entry.label}</span>
								{entry.secondaryLabel ? (
									<span className={styles.sourceItemSecondaryLabel}>
										{entry.secondaryLabel}
									</span>
								) : null}
							</span>
						</>
					)
					const resourcePath = entry.resourcePath
					const hasResource = Boolean(resourcePath)
					const resourceDisplayName =
						resourcePath != null
							? (entry.resourceFileName ??
									resourcePath.split("/").pop() ??
									resourcePath) ||
								""
							: ""
					const slotContent = resourcePath ? (
						<>
							<div className={styles.sourceItemInnerFilled}>
								<ReferenceImageThumbnailImage
									path={resourcePath}
									fileName={resourceDisplayName}
									fillParent
									objectFit="contain"
									inlineOriginal
								/>
							</div>
							<button
								type="button"
								className={styles.sourceItemRemoveButton}
								aria-label={entry.removeResourceAriaLabel ?? "Remove reference"}
								onClick={(e) => {
									e.preventDefault()
									e.stopPropagation()
									entry.onRemoveResource?.()
								}}
							>
								<X size={10} className={styles.sourceItemRemoveIcon} aria-hidden />
							</button>
						</>
					) : (
						emptySlotContent
					)

					const slotItemClassName = cn(
						styles.sourceItem,
						hasResource && styles.sourceItemHasResource,
					)
					const slotItemNode = renderItem ? (
						renderItem({
							option: entry,
							index: slotIndexInList,
							className: slotItemClassName,
							style: {},
							content: slotContent,
							slotRootRef,
						})
					) : (
						<div ref={slotRootRef} className={slotItemClassName}>
							{slotContent}
						</div>
					)

					const contentNode = hasResource ? (
						<Tooltip delayDuration={400}>
							<TooltipTrigger asChild>{slotItemNode}</TooltipTrigger>
							<TooltipPrimitive.Portal container={portalContainer || undefined}>
								<TooltipContent
									side="top"
									sideOffset={6}
									className="max-w-[min(20rem,85vw)] border-black bg-black text-white"
								>
									<span className="block break-all text-left">
										{resourceDisplayName}
									</span>
									<TooltipPrimitive.Arrow className="fill-black" />
								</TooltipContent>
							</TooltipPrimitive.Portal>
						</Tooltip>
					) : (
						slotItemNode
					)

					return <Fragment key={entry.value}>{contentNode}</Fragment>
				})}
				{overlayEntries.length > 0 ? (
					<div
						className={styles.overlayLayer}
						style={
							overlayPos
								? { left: `${overlayPos.x}px`, top: `${overlayPos.y}px` }
								: undefined
						}
					>
						{overlayEntries.map((entry) => (
							<Fragment key={entry.value}>{entry.render()}</Fragment>
						))}
					</div>
				) : null}
			</div>
		</div>
	)
}

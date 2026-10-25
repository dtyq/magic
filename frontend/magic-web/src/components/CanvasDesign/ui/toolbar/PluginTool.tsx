import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { ChevronRight, Puzzle, X } from "lucide-react"
import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import {
	normalizePluginLocale,
	resolvePluginIcon,
	resolvePluginText,
} from "../../runtime/plugins/resolve"
import type { CanvasDesignPluginCategory } from "../../runtime/document/types"
import { useCanvas } from "../../app/providers/CanvasProvider"
import { useCanvasDesignI18n } from "../../app/providers/I18nProvider"
import { useHostUiLocale } from "../../app/providers/HostUiLocaleProvider"
import IconButton from "../primitives/custom/IconButton/index"
import { usePortalContainer } from "../primitives/custom/PortalContainerContext"
import { Popover, PopoverAnchor, PopoverContent } from "../primitives/shadcn/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives/shadcn/tooltip"
import styles from "./index.module.css"

const noop = () => undefined
const HOVER_CLOSE_DELAY_MS = 120
const STATIC_PLUGIN_CATEGORIES = [
	{
		key: "model",
		order: 10,
		labelKey: "tools.pluginCategories.model",
		fallbackLabel: "模特图",
	},
	{
		key: "product",
		order: 30,
		labelKey: "tools.pluginCategories.product",
		fallbackLabel: "商品图",
	},
	{
		key: "fashion-design",
		order: 20,
		labelKey: "tools.pluginCategories.fashionDesign",
		fallbackLabel: "服装设计",
	},
	{
		key: "ai-toolbox",
		order: 5,
		labelKey: "tools.pluginCategories.aiToolbox",
		fallbackLabel: "AI工具箱",
	},
] as const

interface PluginToolViewItem {
	name: string
	resolvedLabel: string
	resolvedDescription: string
	resolvedIcon: ReturnType<typeof resolvePluginIcon>
	category?: CanvasDesignPluginCategory
}

interface PluginCategoryView {
	key: string
	label: string
	plugins: PluginToolViewItem[]
}

export default function PluginTool() {
	const { t } = useCanvasDesignI18n()
	const { canvas } = useCanvas()
	const hostUiLocale = useHostUiLocale()
	const portalContainer = usePortalContainer()
	const [open, setOpen] = useState(false)
	const [activeCategoryKey, setActiveCategoryKey] = useState<string | null>(null)
	const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const triggerRef = useRef<HTMLDivElement>(null)
	const pluginSnapshot = useSyncExternalStore(
		(listener) => canvas?.pluginManager.subscribe(listener) ?? noop,
		() => canvas?.pluginManager.getSnapshot(),
		() => undefined,
	)

	const locale = normalizePluginLocale(hostUiLocale)
	const plugins = useMemo<PluginToolViewItem[]>(() => {
		return (pluginSnapshot?.plugins ?? []).map((plugin) => {
			return {
				...plugin,
				resolvedLabel: resolvePluginText(plugin, plugin.label, locale),
				resolvedDescription: resolvePluginText(plugin, plugin.description, locale),
				resolvedIcon: resolvePluginIcon(plugin),
			}
		})
	}, [locale, pluginSnapshot?.plugins])

	const categories = useMemo<PluginCategoryView[]>(() => {
		const staticCategoryMap = new Map<string, PluginCategoryView>(
			STATIC_PLUGIN_CATEGORIES.map((category) => [
				category.key,
				{
					key: category.key,
					label: t(category.labelKey, category.fallbackLabel),
					order: category.order,
					plugins: [],
				},
			]),
		)

		for (const plugin of plugins) {
			const categoryKey = plugin.category?.key || "other"
			const existingCategory = staticCategoryMap.get(categoryKey)
			if (existingCategory) {
				existingCategory.plugins.push(plugin)
				continue
			}

			staticCategoryMap.set(categoryKey, {
				key: categoryKey,
				label: plugin.category?.label || categoryKey,
				plugins: [plugin],
			})
		}

		return Array.from(staticCategoryMap.values()).filter(
			(category) => category.plugins.length > 0,
		)
	}, [plugins, t])

	const activeCategory = useMemo(() => {
		return (
			categories.find((category) => category.key === activeCategoryKey) ??
			categories[0] ??
			null
		)
	}, [activeCategoryKey, categories])

	const label = t("tools.plugins", "插件")
	const emptyCategoryLabel = t("tools.pluginCategoryEmpty", "该分类下暂无插件")
	const isPluginListPanelOpen = open

	useEffect(() => {
		return () => {
			if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
		}
	}, [])

	const clearCloseTimer = () => {
		if (!closeTimerRef.current) return
		clearTimeout(closeTimerRef.current)
		closeTimerRef.current = null
	}

	const handleHoverOpen = () => {
		clearCloseTimer()
		setOpen(true)
	}

	const handleHoverClose = () => {
		clearCloseTimer()
		closeTimerRef.current = setTimeout(() => {
			setOpen(false)
			closeTimerRef.current = null
		}, HOVER_CLOSE_DELAY_MS)
	}

	const pluginTrigger = (
		<PopoverAnchor asChild>
			<div ref={triggerRef} onMouseEnter={handleHoverOpen} onMouseLeave={handleHoverClose}>
				<IconButton className={styles.toolItem} selected={open}>
					<Puzzle size={16} />
				</IconButton>
			</div>
		</PopoverAnchor>
	)

	return (
		<Popover open={open} onOpenChange={setOpen}>
			{isPluginListPanelOpen ? (
				pluginTrigger
			) : (
				<Tooltip delayDuration={0}>
					<TooltipTrigger asChild>{pluginTrigger}</TooltipTrigger>
					<TooltipPrimitive.Portal container={portalContainer || undefined}>
						<TooltipContent side="top" sideOffset={8} className="border-black bg-black">
							<div>
								<span className={styles.tooltipLabel}>{label}</span>
							</div>
							<TooltipPrimitive.Arrow className="fill-black" />
						</TooltipContent>
					</TooltipPrimitive.Portal>
				</Tooltip>
			)}

			<PopoverContent
				align="end"
				side="top"
				sideOffset={8}
				className="border-base-border w-[30rem] overflow-hidden bg-white p-0"
				data-canvas-plugin-list-panel
				onOpenAutoFocus={(event) => event.preventDefault()}
				onCloseAutoFocus={(event) => event.preventDefault()}
				onMouseEnter={handleHoverOpen}
				onMouseLeave={handleHoverClose}
				onPointerDownOutside={(event) => {
					if (triggerRef.current?.contains(event.target as Node)) {
						event.preventDefault()
					}
				}}
			>
				<div className={styles.pluginPanel}>
					<div className={styles.pluginPanelHeader}>
						<div className={styles.pluginPanelTitle}>{label}</div>
						<button
							type="button"
							className={styles.pluginPanelClose}
							onClick={() => setOpen(false)}
							aria-label="close plugin panel"
						>
							<X size={16} />
						</button>
					</div>

					<div className={styles.pluginPanelBody}>
						<div className={styles.pluginCategoryNav}>
							{categories.map((category) => {
								const selected = category.key === activeCategory?.key
								return (
									<button
										key={category.key}
										type="button"
										className={`${styles.pluginCategoryTab} ${selected ? styles.pluginCategoryTabSelected : ""}`.trim()}
										onClick={() => setActiveCategoryKey(category.key)}
									>
										<span className={styles.pluginCategoryLabel}>
											{category.label}
										</span>
										<span className={styles.pluginCategoryCount}>
											{category.plugins.length}
										</span>
									</button>
								)
							})}
						</div>

						<div className={styles.pluginListPane}>
							{activeCategory?.plugins.length ? (
								<div className={styles.pluginList}>
									{activeCategory.plugins.map((plugin) => {
										const pluginButton = (
											<button
												type="button"
												className={styles.pluginItem}
												onClick={() => {
													canvas?.pluginManager.open(plugin.name)
													setOpen(false)
												}}
											>
												<div className={styles.pluginIcon}>
													{plugin.resolvedIcon?.type === "emoji" ? (
														plugin.resolvedIcon.value
													) : plugin.resolvedIcon?.type === "image" ? (
														<img
															src={plugin.resolvedIcon.value}
															alt=""
															className={styles.pluginIconImage}
														/>
													) : (
														<Puzzle size={18} />
													)}
												</div>
												<div className={styles.pluginInfo}>
													<div className={styles.pluginName}>
														{plugin.resolvedLabel}
													</div>
													<div className={styles.pluginDescription}>
														{plugin.resolvedDescription}
													</div>
												</div>
												<ChevronRight
													size={16}
													className={styles.pluginItemArrow}
												/>
											</button>
										)

										if (!plugin.resolvedDescription) {
											return (
												<Fragment key={plugin.name}>
													{pluginButton}
												</Fragment>
											)
										}

										return (
											<Tooltip delayDuration={200} key={plugin.name}>
												<TooltipTrigger asChild>
													{pluginButton}
												</TooltipTrigger>
												<TooltipPrimitive.Portal
													container={portalContainer || undefined}
												>
													<TooltipContent
														side="right"
														sideOffset={8}
														className="max-w-xs"
													>
														{plugin.resolvedDescription}
													</TooltipContent>
												</TooltipPrimitive.Portal>
											</Tooltip>
										)
									})}
								</div>
							) : (
								<div className={styles.pluginListEmpty}>{emptyCategoryLabel}</div>
							)}
						</div>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}

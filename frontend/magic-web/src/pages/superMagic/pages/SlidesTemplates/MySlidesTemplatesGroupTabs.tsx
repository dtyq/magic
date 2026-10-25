import {
	useCallback,
	Fragment,
	useEffect,
	useId,
	useRef,
	useState,
	type FocusEvent,
	type KeyboardEvent,
} from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import type { TemplateGroupSelectorOptionProps } from "@/pages/superMagic/components/MainInputContainer/panels/TemplateGroupSelector"
import type { MySlidesTemplateSection } from "@/pages/superMagic/services/mySlidesTemplateAdapter"

interface MySlidesTemplatesGroupTabsProps {
	activeSection: MySlidesTemplateSection
	isSelected: boolean
	onGroupClick: () => void
	onSectionChange: (section: MySlidesTemplateSection) => void
	optionProps: Omit<TemplateGroupSelectorOptionProps, "onClick">
	variant?: "default" | "dark"
	flat?: boolean
}

const SECTIONS = [{ key: "created" }, { key: "favorites" }, { key: "used" }] as const

export default function MySlidesTemplatesGroupTabs({
	activeSection,
	isSelected,
	onGroupClick,
	onSectionChange,
	optionProps,
	variant = "default",
	flat = false,
}: MySlidesTemplatesGroupTabsProps) {
	const { t } = useTranslation("super")
	const tabListId = useId()
	const shellRef = useRef<HTMLDivElement>(null)
	const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
	const [isPointerExpanded, setIsPointerExpanded] = useState(false)
	const [isFocusExpanded, setIsFocusExpanded] = useState(false)
	const isExpanded = isSelected || isPointerExpanded || isFocusExpanded

	function getSectionLabel(section: MySlidesTemplateSection) {
		if (section === "created") return t("mySlidesTemplates.sections.created")
		if (section === "favorites") return t("mySlidesTemplates.sections.favorites")
		return t("mySlidesTemplates.sections.used")
	}

	function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
		let nextIndex: number | null = null
		if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % SECTIONS.length
		if (event.key === "ArrowLeft") {
			nextIndex = (currentIndex - 1 + SECTIONS.length) % SECTIONS.length
		}
		if (event.key === "Home") nextIndex = 0
		if (event.key === "End") nextIndex = SECTIONS.length - 1
		if (nextIndex === null) return

		event.preventDefault()
		const nextSection = SECTIONS[nextIndex].key
		if (!isSelected) onGroupClick()
		onSectionChange(nextSection)
		tabRefs.current[nextIndex]?.focus()
	}

	function handleBlurCapture(event: FocusEvent<HTMLDivElement>) {
		if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
		setIsFocusExpanded(false)
	}

	const scrollGroupIntoView = useCallback(() => {
		const shell = shellRef.current
		if (typeof shell?.scrollIntoView !== "function") return

		shell.scrollIntoView({
			behavior: "smooth",
			inline: "center",
			block: "nearest",
		})
	}, [])

	useEffect(() => {
		if (!flat) return
		const frameId = window.requestAnimationFrame(() => {
			tabRefs.current[0]?.scrollIntoView({
				behavior: "auto",
				inline: "start",
				block: "nearest",
			})
		})
		return () => window.cancelAnimationFrame(frameId)
	}, [flat])

	if (flat) {
		return (
			<Fragment>
				{SECTIONS.map(({ key }, index) => {
					const isActive = isSelected && activeSection === key
					const isTabStop = (isSelected ? activeSection : "created") === key

					return (
						<Button
							ref={(node) => {
								tabRefs.current[index] = node
							}}
							key={key}
							type="button"
							variant={isActive ? "outline" : "secondary"}
							aria-pressed={isActive}
							tabIndex={isTabStop ? 0 : -1}
							className={cn(
								"h-9 shrink-0 gap-2 rounded-full border-2 border-transparent px-4 py-2 font-normal shadow-xs active:scale-[0.96]",
								variant === "default" &&
									isActive &&
									"border-primary bg-background text-primary shadow-xs hover:bg-background",
								optionProps.className,
								variant === "dark" &&
									isActive &&
									"border-white/40 bg-white/20 text-white shadow-sm hover:bg-white/20",
							)}
							data-selected={isActive}
							data-testid={
								index === 0
									? optionProps["data-testid"]
									: `my-slides-templates-section-${key}`
							}
							onClick={() => {
								if (!isSelected) onGroupClick()
								onSectionChange(key)
							}}
							onKeyDown={(event) => handleTabKeyDown(event, index)}
						>
							<span className="whitespace-nowrap text-sm leading-5">
								{getSectionLabel(key)}
							</span>
						</Button>
					)
				})}
			</Fragment>
		)
	}

	return (
		<div
			ref={shellRef}
			className={cn(
				"flex h-9 shrink-0 items-center overflow-hidden rounded-full border-2 border-transparent p-1 shadow-xs transition-[background-color,border-color,box-shadow] duration-150",
				"max-w-full",
				variant === "default" &&
					"bg-secondary text-secondary-foreground hover:bg-secondary/80",
				variant === "dark" && optionProps.className,
			)}
			data-expanded={isExpanded}
			data-selected="false"
			data-testid="my-slides-templates-group-tabs-shell"
			onMouseEnter={() => setIsPointerExpanded(true)}
			onMouseLeave={() => setIsPointerExpanded(false)}
			onFocusCapture={() => setIsFocusExpanded(true)}
			onBlurCapture={handleBlurCapture}
		>
			<button
				type="button"
				className={cn(
					"flex h-7 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-normal text-current outline-none transition-[color,transform] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 active:scale-[0.96]",
				)}
				aria-controls={tabListId}
				aria-expanded={isExpanded}
				data-selected="false"
				data-testid={optionProps["data-testid"]}
				onClick={() => {
					onGroupClick()
					window.requestAnimationFrame(scrollGroupIntoView)
				}}
			>
				{optionProps.icon}
				<span className="whitespace-nowrap leading-5">{optionProps.label}</span>
			</button>

			<div
				className={cn(
					"shrink-0 overflow-hidden transition-[max-width,opacity] duration-200 ease-out motion-reduce:transition-none",
					isExpanded
						? "max-w-[min(32rem,calc(100vw-1rem))] opacity-100"
						: "pointer-events-none max-w-0 opacity-0",
				)}
				aria-hidden={!isExpanded}
				data-expanded={isExpanded}
				data-testid="my-slides-templates-section-tabs-region"
			>
				<div
					id={tabListId}
					role="tablist"
					aria-label={t("mySlidesTemplates.sections.label")}
					className={cn(
						"no-scrollbar flex h-7 max-w-full items-center overflow-x-auto rounded-full bg-background/70 p-0.5",
						variant === "dark" && "bg-black/20",
					)}
					data-testid="my-slides-templates-section-tabs"
				>
					{SECTIONS.map(({ key }, index) => {
						const isActive = isSelected && activeSection === key
						const isTabStop = (isSelected ? activeSection : "created") === key
						return (
							<button
								ref={(node) => {
									tabRefs.current[index] = node
								}}
								key={key}
								type="button"
								role="tab"
								aria-selected={isActive}
								tabIndex={isExpanded && isTabStop ? 0 : -1}
								className={cn(
									"flex h-7 items-center rounded-full border-2 border-transparent px-2.5 text-xs font-normal outline-none transition-[background-color,border-color,color,box-shadow,transform] focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]",
									variant === "default" &&
										"text-secondary-foreground hover:bg-background/70",
									variant === "default" &&
										isActive &&
										"border-primary bg-background font-medium text-primary shadow-xs hover:bg-background",
									variant === "dark" &&
										"text-white/70 hover:bg-white/10 hover:text-white focus-visible:ring-white/70",
									variant === "dark" &&
										isActive &&
										"border-white/40 bg-white/20 text-white shadow-sm hover:bg-white/20",
								)}
								data-testid={`my-slides-templates-section-${key}`}
								onClick={() => {
									if (!isSelected) {
										onGroupClick()
										window.requestAnimationFrame(scrollGroupIntoView)
									}
									onSectionChange(key)
								}}
								onKeyDown={(event) => handleTabKeyDown(event, index)}
							>
								<span className="whitespace-nowrap">{getSectionLabel(key)}</span>
							</button>
						)
					})}
				</div>
			</div>
		</div>
	)
}

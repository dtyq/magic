import * as React from "react"
import type { Editor } from "@tiptap/react"
import { useTranslation } from "react-i18next"
import {
	IconChevronRight,
	IconArrowUp,
	IconArrowDown,
	IconX,
	IconReplace,
	IconReplaceFilled,
} from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import { useSearchAndReplace } from "./hooks"
import "./search-and-replace.scss"

interface SearchAndReplaceProps {
	editor: Editor | null
	visible: boolean
	onClose: () => void
}

export function SearchAndReplace({ editor, visible, onClose }: SearchAndReplaceProps) {
	const { t } = useTranslation("tiptap")
	const [showReplace, setShowReplace] = React.useState(false)
	const searchInputRef = React.useRef<HTMLInputElement>(null)
	const replaceInputRef = React.useRef<HTMLInputElement>(null)

	const {
		searchTerm,
		replaceTerm,
		results,
		resultIndex,
		caseSensitive,
		useRegex,
		setSearchTerm,
		setReplaceTerm,
		toggleCaseSensitive,
		toggleUseRegex,
		goToNext,
		goToPrevious,
		replace,
		replaceAll,
		clear,
	} = useSearchAndReplace({ editor })

	// Focus search input when panel becomes visible
	React.useEffect(() => {
		if (visible) {
			requestAnimationFrame(() => {
				searchInputRef.current?.focus()
				searchInputRef.current?.select()
			})
		}
	}, [visible])

	// Keyboard shortcut: Cmd/Ctrl+F to open/focus, Escape to close
	const handleClose = useMemoizedFn(() => {
		clear()
		onClose()
	})

	React.useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Cmd/Ctrl+F
			if (e.key === "f" && (e.metaKey || e.ctrlKey) && !e.altKey) {
				e.preventDefault()
				e.stopPropagation()
				if (!visible) {
					// The parent will handle opening
					return
				}
				// If already visible, focus and select the search input
				searchInputRef.current?.focus()
				searchInputRef.current?.select()
			}

			// Escape to close — stop propagation so the editor's own Escape handler
			// (e.g. exiting edit mode) is not triggered after the panel closes
			if (e.key === "Escape" && visible) {
				e.preventDefault()
				e.stopPropagation()
				handleClose()
			}
		}

		window.addEventListener("keydown", handleKeyDown, true)
		return () => window.removeEventListener("keydown", handleKeyDown, true)
	}, [visible, handleClose])

	const handleSearchKeyDown = useMemoizedFn((e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault()
			if (e.shiftKey) {
				goToPrevious()
			} else {
				goToNext()
			}
		}
	})

	const handleReplaceKeyDown = useMemoizedFn((e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault()
			replace()
		}
	})

	if (!visible) return null

	const isEditable = editor?.isEditable ?? false
	const hasResults = results.length > 0
	const resultCountText = searchTerm
		? hasResults
			? t("toolbar.searchReplace.resultCount", {
					current: resultIndex + 1,
					total: results.length,
				})
			: t("toolbar.searchReplace.noResults")
		: ""

	return (
		<div
			className="search-and-replace-panel"
			role="dialog"
			aria-label={t("toolbar.searchReplace.search")}
		>
			{/* Toggle expand/collapse for replace row (only in editable mode) */}
			{isEditable && (
				<div className="search-panel-toggle">
					<button
						className="search-panel-toggle-btn"
						data-expanded={showReplace}
						onClick={() => setShowReplace(!showReplace)}
						aria-label={showReplace ? "Collapse replace" : "Expand replace"}
						type="button"
					>
						<IconChevronRight size={14} />
					</button>
				</div>
			)}

			{/* Content area */}
			<div className="search-panel-content">
				{/* Search row */}
				<div className="search-panel-row">
					<div className="search-panel-input-wrapper">
						<input
							ref={searchInputRef}
							className="search-panel-input"
							type="text"
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							onKeyDown={handleSearchKeyDown}
							placeholder={t("toolbar.searchReplace.searchPlaceholder")}
							aria-label={t("toolbar.searchReplace.search")}
						/>
						<button
							className="search-panel-inline-btn"
							data-active={caseSensitive}
							onClick={toggleCaseSensitive}
							title={t("toolbar.searchReplace.caseSensitive")}
							type="button"
							aria-label={t("toolbar.searchReplace.caseSensitive")}
						>
							Aa
						</button>
						<button
							className="search-panel-inline-btn"
							data-active={useRegex}
							onClick={toggleUseRegex}
							title={t("toolbar.searchReplace.useRegex")}
							type="button"
							aria-label={t("toolbar.searchReplace.useRegex")}
						>
							.*
						</button>
					</div>
					<span className="search-panel-count">{resultCountText}</span>
					<button
						className="search-panel-btn"
						onClick={goToPrevious}
						disabled={!hasResults}
						title={t("toolbar.searchReplace.previousMatch")}
						type="button"
						aria-label={t("toolbar.searchReplace.previousMatch")}
					>
						<IconArrowUp size={14} />
					</button>
					<button
						className="search-panel-btn"
						onClick={goToNext}
						disabled={!hasResults}
						title={t("toolbar.searchReplace.nextMatch")}
						type="button"
						aria-label={t("toolbar.searchReplace.nextMatch")}
					>
						<IconArrowDown size={14} />
					</button>
					<button
						className="search-panel-btn"
						onClick={handleClose}
						title={t("toolbar.searchReplace.close")}
						type="button"
						aria-label={t("toolbar.searchReplace.close")}
					>
						<IconX size={14} />
					</button>
				</div>

				{/* Replace row (collapsible, only in editable mode) */}
				{isEditable && showReplace && (
					<div className="search-panel-row">
						<div className="search-panel-input-wrapper">
							<input
								ref={replaceInputRef}
								className="search-panel-input"
								type="text"
								value={replaceTerm}
								onChange={(e) => setReplaceTerm(e.target.value)}
								onKeyDown={handleReplaceKeyDown}
								placeholder={t("toolbar.searchReplace.replacePlaceholder")}
								aria-label={t("toolbar.searchReplace.replace")}
							/>
						</div>
						<button
							className="search-panel-btn"
							onClick={replace}
							disabled={!hasResults}
							title={t("toolbar.searchReplace.replace")}
							type="button"
							aria-label={t("toolbar.searchReplace.replace")}
						>
							<IconReplace size={14} />
						</button>
						<button
							className="search-panel-btn"
							onClick={replaceAll}
							disabled={!hasResults}
							title={t("toolbar.searchReplace.replaceAll")}
							type="button"
							aria-label={t("toolbar.searchReplace.replaceAll")}
						>
							<IconReplaceFilled size={14} />
						</button>
					</div>
				)}
			</div>
		</div>
	)
}

import { createSourceLocationPlugin } from "./source-location"
import {
	forwardRef,
	memo,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type AnchorHTMLAttributes,
	type ComponentProps,
	type HTMLAttributes,
	type RefObject,
} from "react"
import type { Element as HastElement, Root, RootContent } from "hast"
import { ArrowDown, ArrowUp, X } from "lucide-react"
import ReactMarkdown, { type Components } from "react-markdown"
import { useTranslation } from "react-i18next"
import rehypeRaw from "rehype-raw"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import remarkGfm from "remark-gfm"
import { remarkSpacedFileLinks } from "@/pages/superMagic/utils/remarkSpacedFileLinks"
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso"
import { useTheme } from "@/models/config/hooks"
import { cn } from "@/utils/cn"
import { parseAnchorLink, scrollToAnchor, slugify } from "@/utils/slug"
import { MarkdownFileLink } from "../MarkdownFileLink"
import { copyMarkdownFileLinks } from "../markdown-file-link-clipboard"
import {
	getVirtualMarkdownChunkContent,
	splitMarkdownIntoVirtualChunks,
	type VirtualMarkdownChunk,
} from "../../largeMarkdown"
import SearchWorker from "./largeMarkdownSearch.worker?worker"
import { searchMarkdown, type MarkdownSearchResult } from "./largeMarkdownSearch"
// This preview renders the SimpleEditor markup contract, so it must own the same stylesheet
// set. Relying on the lazily loaded rich editor to inject them left the wrapper at
// `height: auto`, which collapsed the Virtuoso scroller to 0px on a direct large-file preview.
import "@/components/tiptap-templates/simple/simple-editor-styles"
import "@/components/tiptap-templates/simple/components/SearchAndReplace/search-and-replace.scss"

interface LargeMarkdownPreviewProps {
	enableSourceLocation?: boolean
	content: string
	className?: string
	documentFlow?: boolean
	/** Cached file tabs stay mounted; only the active tab should own global search shortcuts. */
	isTabActive?: boolean
	/** Offscreen export renders EditorBody temporarily and must not create search side effects. */
	enableSearch?: boolean
	urlResolver?: (relativePath: string) => string | Promise<string>
	onLinkClick?: (
		event: MouseEvent,
		href: string,
		element: HTMLAnchorElement,
		anchor?: string,
	) => boolean
}

const markdownSanitizeSchema = {
	...defaultSchema,
	tagNames: [...(defaultSchema.tagNames ?? []), "mark"],
	attributes: {
		...defaultSchema.attributes,
		img: [...(defaultSchema.attributes?.img ?? []), "width", "height"],
	},
}

interface LocalSearchMatch {
	id: string
	start: number
	end: number
}

interface SearchWorkerResponse {
	requestId: number
	results: MarkdownSearchResult[]
}

// Keep the empty prop identity stable so memoized chunks without matches do not re-render
// while the current search result is being moved between other chunks.
const EMPTY_SEARCH_RESULTS: MarkdownSearchResult[] = []
const SEARCH_WORKER_TIMEOUT_MS = 1500

const VirtualMarkdownList = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
	function VirtualMarkdownList({ className, style, ...props }, ref) {
		// ReactMarkdown inserts newline text nodes between block elements. TipTap's
		// pre-wrap style makes those nodes occupy an extra visual line in every chunk.
		return (
			<div
				ref={ref}
				className={cn("tiptap ProseMirror simple-editor", className)}
				style={{ ...style, whiteSpace: "normal" }}
				{...props}
			/>
		)
	},
)

function getHastNodeText(node: Root | RootContent): string {
	if (node.type === "text") return node.value
	if ("children" in node) return node.children.map(getHastNodeText).join("")
	return ""
}

function createHeadingIdPlugin(headingSlugs: string[]) {
	return () => (tree: Root) => {
		let headingIndex = 0

		const visit = (node: Root | RootContent) => {
			if (node.type === "element" && /^h[1-6]$/.test(node.tagName)) {
				const element = node as HastElement
				const fallbackSlug = slugify(getHastNodeText(element))
				element.properties = {
					...element.properties,
					id: headingSlugs[headingIndex] || fallbackSlug || undefined,
				}
				headingIndex += 1
			}

			if ("children" in node) node.children.forEach(visit)
		}

		visit(tree)
	}
}

function createSearchHighlightPlugin(matches: LocalSearchMatch[]) {
	return () => (tree: Root) => {
		if (matches.length === 0) return

		const visit = (node: Root | RootContent) => {
			if (!("children" in node)) return

			const nextChildren: RootContent[] = []
			node.children.forEach((child: RootContent) => {
				if (child.type !== "text") {
					visit(child)
					nextChildren.push(child)
					return
				}

				const nodeStart = child.position?.start.offset
				const nodeEnd = child.position?.end.offset
				if (nodeStart === undefined || nodeEnd === undefined) {
					nextChildren.push(child)
					return
				}

				const nodeMatches = matches.filter(
					(match) => match.start < nodeEnd && match.end > nodeStart,
				)
				if (nodeMatches.length === 0) {
					nextChildren.push(child)
					return
				}

				let cursor = 0
				nodeMatches.forEach((match) => {
					const highlightStart = Math.max(0, match.start - nodeStart)
					const highlightEnd = Math.min(child.value.length, match.end - nodeStart)
					if (highlightStart > cursor) {
						nextChildren.push({
							type: "text",
							value: child.value.slice(cursor, highlightStart),
						})
					}
					if (highlightEnd > highlightStart) {
						nextChildren.push({
							type: "element",
							tagName: "mark",
							properties: {
								className: ["search-result"],
								"data-search-result-id": match.id,
							},
							children: [
								{
									type: "text",
									value: child.value.slice(highlightStart, highlightEnd),
								},
							],
						})
					}
					cursor = Math.max(cursor, highlightEnd)
				})

				if (cursor < child.value.length) {
					nextChildren.push({ type: "text", value: child.value.slice(cursor) })
				}
			})

			node.children = nextChildren
		}

		visit(tree)
	}
}

function scrollVirtuosoScroller(scroller: HTMLElement | Window, top: number) {
	if (top === 0) return
	if (typeof scroller.scrollBy === "function") {
		// The numeric overload is equivalent to behavior:auto and also works in Safari 13,
		// which does not fully support the ScrollToOptions overload.
		scroller.scrollBy(0, top)
		return
	}

	// Older embedded WebViews may expose scrollTop/scrollTo but not the options form
	// of scrollBy. Keep search navigation functional instead of throwing at runtime.
	if (scroller === window) {
		window.scrollTo(0, window.scrollY + top)
	} else {
		;(scroller as HTMLElement).scrollTop += top
	}
}

function ResolvedMarkdownImage({
	src,
	urlResolver,
	...props
}: ComponentProps<"img"> & {
	urlResolver?: (relativePath: string) => string | Promise<string>
}) {
	const [resolvedSrc, setResolvedSrc] = useState(src)

	useEffect(() => {
		let disposed = false
		setResolvedSrc(src)
		if (!src || !urlResolver) return () => undefined

		Promise.resolve(urlResolver(src))
			.then((nextSrc) => {
				if (!disposed) setResolvedSrc(nextSrc)
			})
			.catch(() => {
				if (!disposed) setResolvedSrc(src)
			})

		return () => {
			disposed = true
		}
	}, [src, urlResolver])

	return <img {...props} src={resolvedSrc} />
}

interface MarkdownChunkProps {
	enableSourceLocation?: boolean
	chunk: VirtualMarkdownChunk
	content: string
	searchMatches: MarkdownSearchResult[]
	urlResolver?: LargeMarkdownPreviewProps["urlResolver"]
	onAnchorClick: (href: string) => boolean
	onLinkClick?: LargeMarkdownPreviewProps["onLinkClick"]
}

const MarkdownChunk = memo(function MarkdownChunk({
	enableSourceLocation = false,
	chunk,
	content,
	searchMatches,
	urlResolver,
	onAnchorClick,
	onLinkClick,
}: MarkdownChunkProps) {
	const sourceLocationPlugin = useMemo(
		() => createSourceLocationPlugin(chunk, enableSourceLocation),
		[chunk, enableSourceLocation],
	)
	const headingIdPlugin = useMemo(
		() => createHeadingIdPlugin(chunk.headingSlugs),
		[chunk.headingSlugs],
	)
	const searchHighlightPlugin = useMemo(() => {
		const prefixLength = chunk.prefix?.length ?? 0
		const localMatches = searchMatches.flatMap<LocalSearchMatch>((result) => {
			const clippedStart = Math.max(result.start, chunk.start)
			const clippedEnd = Math.min(result.end, chunk.end)
			if (clippedStart >= clippedEnd) return []

			return [
				{
					id: result.id,
					start: prefixLength + clippedStart - chunk.start,
					end: prefixLength + clippedEnd - chunk.start,
				},
			]
		})
		return createSearchHighlightPlugin(localMatches)
	}, [chunk.end, chunk.prefix, chunk.start, searchMatches])
	const components = useMemo<Components>(
		() => ({
			a: ({ href = "", ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
				<MarkdownFileLink
					{...props}
					href={href}
					onClick={(event) => {
						if (onAnchorClick(href)) {
							event.preventDefault()
							return
						}
						if (!onLinkClick) return
						if (onLinkClick(event.nativeEvent, href, event.currentTarget) === true)
							event.preventDefault()
					}}
				/>
			),
			img: ({ node, ...props }) => {
				void node
				return <ResolvedMarkdownImage {...props} urlResolver={urlResolver} />
			},
			table: ({ node, ...props }) => {
				void node
				return (
					<div className="tableWrapper">
						<table {...props} />
					</div>
				)
			},
			input: ({ node, checked, ...props }) => {
				void node
				return <input {...props} type="checkbox" checked={checked} readOnly />
			},
		}),
		[onAnchorClick, onLinkClick, urlResolver],
	)

	return (
		<div data-markdown-chunk-id={chunk.id}>
			<ReactMarkdown
				remarkPlugins={[remarkGfm, remarkSpacedFileLinks]}
				rehypePlugins={[
					rehypeRaw,
					[rehypeSanitize, markdownSanitizeSchema],
					sourceLocationPlugin,
					searchHighlightPlugin,
					headingIdPlugin,
				]}
				urlTransform={(url) => url}
				components={components}
			>
				{getVirtualMarkdownChunkContent(content, chunk)}
			</ReactMarkdown>
		</div>
	)
})

interface LargeMarkdownSearchToolbarProps {
	visible: boolean
	documentFlow: boolean
	query: string
	caseSensitive: boolean
	useRegex: boolean
	resultIndex: number
	resultCount: number
	inputRef: RefObject<HTMLInputElement>
	onQueryChange: (query: string) => void
	onToggleCaseSensitive: () => void
	onToggleRegex: () => void
	onPrevious: () => void
	onNext: () => void
	onClose: () => void
}

function LargeMarkdownSearchToolbar({
	visible,
	documentFlow,
	query,
	caseSensitive,
	useRegex,
	resultIndex,
	resultCount,
	inputRef,
	onQueryChange,
	onToggleCaseSensitive,
	onToggleRegex,
	onPrevious,
	onNext,
	onClose,
}: LargeMarkdownSearchToolbarProps) {
	const { t } = useTranslation("tiptap")
	if (!visible) return null

	const resultCountText = query
		? resultCount > 0
			? t("toolbar.searchReplace.resultCount", {
					current: resultIndex + 1,
					total: resultCount,
				})
			: t("toolbar.searchReplace.noResults")
		: ""

	return (
		<div
			className={cn(
				"search-and-replace-panel",
				documentFlow && "large-markdown-search-panel-document-flow",
			)}
			role="dialog"
			aria-label={t("toolbar.searchReplace.search")}
			onKeyDown={(event) => {
				if (event.key === "f" && (event.metaKey || event.ctrlKey) && !event.altKey) {
					event.preventDefault()
					event.stopPropagation()
					inputRef.current?.focus()
					inputRef.current?.select()
				}
				if (event.key === "Escape") {
					event.preventDefault()
					event.stopPropagation()
					onClose()
				}
			}}
		>
			<div className="search-panel-content">
				<div className="search-panel-row">
					<div className="search-panel-input-wrapper">
						<input
							ref={inputRef}
							className="search-panel-input"
							type="text"
							value={query}
							onChange={(event) => onQueryChange(event.target.value)}
							onKeyDown={(event) => {
								if (event.key !== "Enter") return
								event.preventDefault()
								if (event.shiftKey) onPrevious()
								else onNext()
							}}
							placeholder={t("toolbar.searchReplace.searchPlaceholder")}
							aria-label={t("toolbar.searchReplace.search")}
						/>
						<button
							className="search-panel-inline-btn"
							data-active={caseSensitive}
							onClick={onToggleCaseSensitive}
							title={t("toolbar.searchReplace.caseSensitive")}
							type="button"
							aria-label={t("toolbar.searchReplace.caseSensitive")}
						>
							Aa
						</button>
						<button
							className="search-panel-inline-btn"
							data-active={useRegex}
							onClick={onToggleRegex}
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
						onClick={onPrevious}
						disabled={resultCount === 0}
						title={t("toolbar.searchReplace.previousMatch")}
						type="button"
						aria-label={t("toolbar.searchReplace.previousMatch")}
					>
						<ArrowUp size={16} />
					</button>
					<button
						className="search-panel-btn"
						onClick={onNext}
						disabled={resultCount === 0}
						title={t("toolbar.searchReplace.nextMatch")}
						type="button"
						aria-label={t("toolbar.searchReplace.nextMatch")}
					>
						<ArrowDown size={16} />
					</button>
					<button
						className="search-panel-btn"
						onClick={onClose}
						title={t("toolbar.searchReplace.close")}
						type="button"
						aria-label={t("toolbar.searchReplace.close")}
					>
						<X size={16} />
					</button>
				</div>
			</div>
		</div>
	)
}

export default function LargeMarkdownPreview({
	enableSourceLocation = false,
	content,
	className,
	documentFlow = false,
	isTabActive = true,
	enableSearch = true,
	urlResolver,
	onLinkClick,
}: LargeMarkdownPreviewProps) {
	const chunks = useMemo(() => splitMarkdownIntoVirtualChunks(content), [content])
	const virtuosoRef = useRef<VirtuosoHandle>(null)
	const rootRef = useRef<HTMLDivElement>(null)
	const searchInputRef = useRef<HTMLInputElement>(null)
	const searchWorkerRef = useRef<Worker | null>(null)
	const searchWorkerTimeoutRef = useRef<number | null>(null)
	const searchRequestIdRef = useRef(0)
	const searchNavigationIdRef = useRef(0)
	const virtuosoScrollerRef = useRef<HTMLElement | Window | null>(null)
	const [searchVisible, setSearchVisible] = useState(false)
	const [searchQuery, setSearchQuery] = useState("")
	const [caseSensitive, setCaseSensitive] = useState(false)
	const [useRegex, setUseRegex] = useState(false)
	const [searchResults, setSearchResults] = useState<MarkdownSearchResult[]>([])
	const [searchResultIndex, setSearchResultIndex] = useState(0)
	const { prefersColorScheme } = useTheme()
	const searchEnabled = enableSearch && isTabActive
	const createSearchWorker = useCallback(() => {
		const nextWorker = new SearchWorker()
		nextWorker.onmessage = (event: MessageEvent<SearchWorkerResponse>) => {
			if (searchWorkerRef.current !== nextWorker) return
			if (
				event.data.requestId === searchRequestIdRef.current &&
				searchWorkerTimeoutRef.current !== null
			) {
				window.clearTimeout(searchWorkerTimeoutRef.current)
				searchWorkerTimeoutRef.current = null
			}
			if (event.data.requestId !== searchRequestIdRef.current) return
			setSearchResults(event.data.results)
			setSearchResultIndex(0)
		}
		nextWorker.postMessage({ type: "init", content, chunks })
		searchWorkerRef.current = nextWorker
		return nextWorker
	}, [chunks, content])
	const resultsByChunk = useMemo(() => {
		const resultMap = new Map<number, MarkdownSearchResult[]>()
		searchResults.forEach((result) => {
			chunks.forEach((chunk, chunkIndex) => {
				if (result.start >= chunk.end || result.end <= chunk.start) return
				const list = resultMap.get(chunkIndex) ?? []
				list.push(result)
				resultMap.set(chunkIndex, list)
			})
		})
		return resultMap
	}, [chunks, searchResults])
	const currentSearchResult = searchResults[searchResultIndex]

	useLayoutEffect(() => {
		const root = rootRef.current
		if (!root) return

		// Changing only the current marker avoids re-running ReactMarkdown for every mounted
		// chunk on each Enter/Arrow navigation. That re-parse can trigger Virtuoso measurements
		// and browser scroll anchoring even when the next result has the same viewport position.
		root.querySelectorAll<HTMLElement>(".search-result-current").forEach((element) => {
			element.classList.remove("search-result-current")
		})
		if (!searchEnabled || !currentSearchResult) return

		const selector = `[data-search-result-id="${currentSearchResult.id}"]`
		root.querySelectorAll<HTMLElement>(selector).forEach((element) => {
			element.classList.add("search-result-current")
		})
	}, [currentSearchResult, searchEnabled])

	useEffect(() => {
		if (!searchEnabled) return

		// Invalidate responses from a worker that was initialized with the previous document.
		searchRequestIdRef.current += 1
		let worker: Worker | null = null
		try {
			worker = createSearchWorker()
		} catch {
			// Vitest and older embedded browsers may not expose module workers. Literal searches
			// can use the bounded synchronous fallback; regex searches remain disabled to protect
			// the main thread from pathological expressions.
			searchWorkerRef.current = null
		}

		return () => {
			worker?.terminate()
			if (searchWorkerRef.current && searchWorkerRef.current !== worker) {
				searchWorkerRef.current.terminate()
			}
			searchWorkerRef.current = null
			if (searchWorkerTimeoutRef.current !== null) {
				window.clearTimeout(searchWorkerTimeoutRef.current)
				searchWorkerTimeoutRef.current = null
			}
		}
	}, [createSearchWorker, searchEnabled])

	useEffect(() => {
		// Every search-state transition invalidates the previous request first. This
		// includes clearing the query, so a late worker response can never repopulate
		// results for an empty search box.
		searchRequestIdRef.current += 1
		if (searchWorkerTimeoutRef.current !== null) {
			window.clearTimeout(searchWorkerTimeoutRef.current)
			searchWorkerTimeoutRef.current = null
		}

		if (!searchEnabled) {
			setSearchVisible(false)
			setSearchQuery("")
			setSearchResults([])
			setSearchResultIndex(0)
			return
		}
		const requestId = searchRequestIdRef.current
		if (!searchQuery) {
			setSearchResults([])
			setSearchResultIndex(0)
			return
		}

		const timer = window.setTimeout(() => {
			if (searchWorkerRef.current) {
				const worker = searchWorkerRef.current
				searchWorkerTimeoutRef.current = window.setTimeout(() => {
					if (
						searchWorkerRef.current !== worker ||
						searchRequestIdRef.current !== requestId
					) {
						return
					}

					// A worker can be terminated safely when a pathological regex exceeds the
					// budget. Do not fall back to the main thread for this request, or the UI
					// could still freeze while trying the same expression synchronously.
					worker.terminate()
					searchWorkerRef.current = null
					searchWorkerTimeoutRef.current = null
					setSearchResults([])
					setSearchResultIndex(0)
					// Recreate the worker immediately so a subsequent search does not
					// permanently lose regex support for this preview instance.
					try {
						createSearchWorker()
					} catch {
						searchWorkerRef.current = null
					}
				}, SEARCH_WORKER_TIMEOUT_MS)
				worker.postMessage({
					type: "search",
					requestId,
					query: searchQuery,
					caseSensitive,
					useRegex,
				})
				return
			}
			if (useRegex) {
				// Regex searches must not fall back to the main thread: an unsupported or timed-out
				// worker must never allow a pathological expression to freeze the preview UI.
				setSearchResults([])
				setSearchResultIndex(0)
				return
			}

			setSearchResults(
				searchMarkdown({ content, chunks, query: searchQuery, caseSensitive, useRegex }),
			)
			setSearchResultIndex(0)
		}, 80)

		return () => window.clearTimeout(timer)
	}, [caseSensitive, chunks, content, createSearchWorker, searchEnabled, searchQuery, useRegex])

	useEffect(() => {
		if (!searchEnabled || !searchVisible) return
		requestAnimationFrame(() => {
			searchInputRef.current?.focus()
			searchInputRef.current?.select()
		})
	}, [searchEnabled, searchVisible])

	useEffect(() => {
		if (!searchEnabled) return

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "f" || (!event.metaKey && !event.ctrlKey) || event.altKey) return
			const activeElement = document.activeElement
			const isTextInput =
				activeElement instanceof HTMLInputElement ||
				activeElement instanceof HTMLTextAreaElement ||
				(activeElement instanceof HTMLElement && activeElement.isContentEditable)
			if (isTextInput && !rootRef.current?.contains(activeElement)) return

			event.preventDefault()
			setSearchVisible(true)
		}

		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [searchEnabled])

	useEffect(() => {
		if (!searchEnabled || !currentSearchResult) return
		const navigationId = searchNavigationIdRef.current + 1
		searchNavigationIdRef.current = navigationId
		const selector = `[data-search-result-id="${currentSearchResult.id}"]`

		const alignMountedResult = (attempt = 0) => {
			if (searchNavigationIdRef.current !== navigationId) return
			const element = rootRef.current?.querySelector<HTMLElement>(selector)
			if (!element) {
				// ReactMarkdown and Virtuoso both render asynchronously after the target item is
				// mounted. Retry for a few frames, while cancelling stale navigation requests.
				if (attempt < 12) requestAnimationFrame(() => alignMountedResult(attempt + 1))
				return
			}
			element.classList.add("search-result-current")

			const scroller = virtuosoScrollerRef.current
			if (!scroller) return
			const elementRect = element.getBoundingClientRect()
			const scrollerElement = scroller === window ? null : (scroller as HTMLElement)
			const scrollerRect = scrollerElement?.getBoundingClientRect()
			const viewportTop = scrollerRect?.top ?? 0
			const viewportBottom = scrollerRect?.bottom ?? window.innerHeight
			const viewportPadding = 80
			let top = 0

			if (elementRect.top < viewportTop + viewportPadding) {
				top = elementRect.top - viewportTop - viewportPadding
			} else if (elementRect.bottom > viewportBottom - viewportPadding) {
				top = elementRect.bottom - viewportBottom + viewportPadding
			}

			// Scroll only Virtuoso's own scroller. Native element.scrollIntoView traverses
			// every scrollable ancestor and caused the outer document to animate from its end.
			scrollVirtuosoScroller(scroller, top)
		}

		const mountedElement = rootRef.current?.querySelector<HTMLElement>(selector)
		if (mountedElement) {
			alignMountedResult()
			return
		}

		// Virtuoso's item-aware API avoids resetting an already visible chunk and calls
		// done only after an off-screen destination has been brought into the render range.
		virtuosoRef.current?.scrollIntoView({
			index: currentSearchResult.chunkIndex,
			align: "center",
			behavior: "auto",
			done: alignMountedResult,
		})
	}, [currentSearchResult, searchEnabled])

	const closeSearch = useCallback(() => {
		setSearchVisible(false)
		setSearchQuery("")
		setSearchResults([])
		setSearchResultIndex(0)
	}, [])
	const goToNextSearchResult = useCallback(() => {
		if (searchResults.length === 0) return
		setSearchResultIndex((index) => (index + 1) % searchResults.length)
	}, [searchResults.length])
	const goToPreviousSearchResult = useCallback(() => {
		if (searchResults.length === 0) return
		setSearchResultIndex((index) => (index - 1 + searchResults.length) % searchResults.length)
	}, [searchResults.length])
	const headingChunkIndex = useMemo(() => {
		const index = new Map<string, number>()
		chunks.forEach((chunk, chunkIndex) => {
			chunk.headingSlugs.forEach((slug) => {
				if (!index.has(slug)) index.set(slug, chunkIndex)
			})
		})
		return index
	}, [chunks])

	const handleAnchorClick = useCallback(
		(href: string) => {
			if (!href.startsWith("#")) return false
			const { anchor } = parseAnchorLink(href)
			const chunkIndex = headingChunkIndex.get(anchor)
			if (chunkIndex === undefined) return false

			virtuosoRef.current?.scrollToIndex({ index: chunkIndex, align: "start" })
			// The target heading is mounted only after Virtuoso reaches its chunk.
			requestAnimationFrame(() => requestAnimationFrame(() => scrollToAnchor(anchor, 80)))
			return true
		},
		[headingChunkIndex],
	)

	return (
		<div
			ref={rootRef}
			className={cn(
				"simple-editor-wrapper tiptap-editor-root",
				prefersColorScheme === "dark" && "dark",
				documentFlow && "simple-editor-document-flow",
				className,
			)}
			data-testid="large-markdown-preview"
			onCopy={copyMarkdownFileLinks}
		>
			<LargeMarkdownSearchToolbar
				visible={searchEnabled && searchVisible}
				documentFlow={documentFlow}
				query={searchQuery}
				caseSensitive={caseSensitive}
				useRegex={useRegex}
				resultIndex={searchResultIndex}
				resultCount={searchResults.length}
				inputRef={searchInputRef}
				onQueryChange={setSearchQuery}
				onToggleCaseSensitive={() => setCaseSensitive((value) => !value)}
				onToggleRegex={() => setUseRegex((value) => !value)}
				onPrevious={goToPreviousSearchResult}
				onNext={goToNextSearchResult}
				onClose={closeSearch}
			/>
			<div className="simple-editor-content">
				<Virtuoso
					ref={virtuosoRef}
					scrollerRef={(scroller) => {
						virtuosoScrollerRef.current = scroller
					}}
					style={documentFlow ? undefined : { height: "100%" }}
					data={chunks}
					useWindowScroll={documentFlow}
					overscan={800}
					components={{ List: VirtualMarkdownList }}
					itemContent={(_index, chunk) => (
						<MarkdownChunk
							enableSourceLocation={enableSourceLocation}
							chunk={chunk}
							content={content}
							searchMatches={resultsByChunk.get(_index) ?? EMPTY_SEARCH_RESULTS}
							urlResolver={urlResolver}
							onAnchorClick={handleAnchorClick}
							onLinkClick={onLinkClick}
						/>
					)}
				/>
			</div>
		</div>
	)
}

export type { LargeMarkdownPreviewProps }

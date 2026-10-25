import { lazy, Suspense, useCallback, useRef, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Loader2, Plus, Search, X } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { useIsMobile } from "@/hooks/useIsMobile"
import GuideTourWrapper from "@/pages/superMagic/components/LazyGuideTour"
import { HomeOnboardingAnchor } from "@/pages/superMagic/components/LazyGuideTour/GuideTourManager"
import { RouteName } from "@/routes/constants"
import useNavigate from "@/routes/hooks/useNavigate"
import MicroAppCreatePrompt from "./components/MicroAppCreatePrompt"
import MicroAppFloatingBackdrop from "./components/MicroAppFloatingBackdrop"
import MicroAppHeroTitle from "./components/MicroAppHeroTitle"
import MicroAppKeyboardCable from "./components/MicroAppKeyboardCable"
import MicroAppLibraryLayout from "./components/MicroAppLibraryLayout"
import MicroAppLibraryPanel from "./components/MicroAppLibraryPanel"
import { useMicroAppsPage } from "./hooks/useMicroAppsPage"
import { useCreateMicroApp } from "./hooks/useCreateMicroApp"

const MicroAppsPageMobile = lazy(() => import("./index.mobile"))
const MicroAppsListPageMobile = lazy(() => import("./list.mobile"))

const MicroAppsPageDesktop = observer(function MicroAppsPageDesktop() {
	const { t } = useTranslation("super")
	const navigate = useNavigate()
	const library = useMicroAppsPage({ initialScope: "created", retainResults: true })
	const { workspace } = library
	const [keyword, setKeyword] = useState("")
	const searching = Boolean(keyword.trim())
	const accessLibrary = useMicroAppsPage({
		initialScope: "recent",
		retainResults: true,
		loadWorkspace: false,
	})
	const searchLibrary = useMicroAppsPage({
		initialScope: "all",
		searchAll: true,
		loadWorkspace: false,
		keyword,
		enabled: searching,
	})
	const { refresh: refreshDevelopment } = library
	const { refresh: refreshAccess } = accessLibrary
	const refreshLibraries = useCallback(() => {
		refreshDevelopment()
		refreshAccess()
	}, [refreshDevelopment, refreshAccess])
	const libraryRef = useRef<HTMLElement>(null)

	const [promptFocused, setPromptFocused] = useState(false)
	const reduceMotion = Boolean(useReducedMotion())
	const [keyboardConnectorReady, setKeyboardConnectorReady] = useState(reduceMotion)
	// 线缆需要标题中的可见标点作为起点；英文标题没有该锚点时不渲染装饰线。
	const keyboardConnectorVisible = /[，,]$/u.test(t("microAppsPage.heroTitlePrefix"))
	const scrollContainerRef = useRef<HTMLDivElement>(null)
	const heroRef = useRef<HTMLElement>(null)
	const heroContentRef = useRef<HTMLDivElement>(null)
	const cableStartRef = useRef<HTMLSpanElement>(null)
	const cableEndRef = useRef<HTMLSpanElement>(null)
	const handleCreated = useCallback(
		(appId: string) => navigate({ name: RouteName.MicroApp, params: { appId } }),
		[navigate],
	)
	const { createApp, creating } = useCreateMicroApp(workspace?.id, handleCreated)

	return (
		<ScrollArea
			viewportRef={scrollContainerRef}
			viewportClassName="[&>div]:!block [&>div]:h-full"
			className="m-2 h-[calc(100%_-_16px)] w-[calc(100%_-_16px)] overflow-hidden rounded-2xl border border-border/70 bg-background shadow-sm [&>[data-slot=scroll-area-scrollbar]]:pointer-events-none [&>[data-slot=scroll-area-scrollbar]]:opacity-0"
			data-testid="micro-apps-page"
		>
			<section
				ref={heroRef}
				className="relative flex min-h-[70%] overflow-hidden border-b border-border/60"
				data-testid="micro-apps-hero"
			>
				<MicroAppFloatingBackdrop
					scrollContainerRef={scrollContainerRef}
					heroRef={heroRef}
					active={promptFocused}
				/>
				<div
					ref={heroContentRef}
					className="relative z-10 mx-auto flex w-full max-w-[1480px] flex-1 flex-col justify-center px-12 py-14"
				>
					{keyboardConnectorVisible ? (
						<MicroAppKeyboardCable
							containerRef={heroContentRef}
							startRef={cableStartRef}
							endRef={cableEndRef}
							active={promptFocused}
							ready={keyboardConnectorReady}
						/>
					) : null}
					<MicroAppHeroTitle
						active={promptFocused}
						connectorRef={keyboardConnectorVisible ? cableStartRef : undefined}
					/>
					<motion.p
						className="text-[#172037]/62 relative z-10 mx-auto mt-6 max-w-3xl text-pretty text-center text-[17px] leading-7 dark:text-white/55"
						initial={reduceMotion ? false : { opacity: 0, y: 14 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
					>
						{t("microAppsPage.heroDescription")}
					</motion.p>
					<motion.div
						className="relative z-10 mx-auto mt-12 w-full max-w-4xl text-left"
						initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.985 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
						onAnimationComplete={() => setKeyboardConnectorReady(true)}
					>
						<MicroAppCreatePrompt
							workspace={workspace}
							onCreated={handleCreated}
							onFocusChange={setPromptFocused}
							keyboardPortRef={cableEndRef}
							keyboardConnectorReady={keyboardConnectorReady}
							keyboardConnectorVisible={keyboardConnectorVisible}
						/>
					</motion.div>
					<div className="mt-6 flex justify-center">
						<Button
							type="button"
							variant="ghost"
							className="cursor-pointer transition-colors duration-150 hover:bg-foreground/5 active:bg-foreground/10 disabled:pointer-events-none motion-reduce:transition-none dark:hover:bg-foreground/10 dark:active:bg-foreground/15"
							onClick={createApp}
							disabled={!workspace?.id || creating}
							data-testid="micro-apps-direct-create"
						>
							{creating ? (
								<Loader2 className="size-4 animate-spin" aria-hidden />
							) : (
								<Plus className="size-4" aria-hidden />
							)}
							{creating
								? t("microAppsPage.creating")
								: t("microAppsPage.createBlankApp")}
						</Button>
					</div>
				</div>
			</section>

			{/*
			 * The library fills the outer viewport: its toolbar stays above independent list scrollers.
			 * The onboarding tour's last step highlights this whole "应用空间" region — heading,
			 * search box, create button and both panels — so the anchor goes on the section rather
			 * than on any control inside it.
			 */}
			<main
				ref={libraryRef}
				data-guide-anchor={HomeOnboardingAnchor.MicroAppsLibrary}
				className="mx-auto flex h-full min-h-0 w-full max-w-[1480px] flex-col px-6 py-5 [container-type:inline-size]"
			>
				<div className="z-10 mb-3 flex shrink-0 flex-wrap items-end justify-between gap-4 bg-background">
					<div>
						<h2 className="text-xl font-semibold tracking-tight text-foreground">
							{t("microAppsPage.galleryTitle")}
						</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							{t("microAppsPage.galleryDescription")}
						</p>
					</div>
					<div className="flex flex-wrap items-center justify-end gap-3">
						<div className="relative w-56">
							<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								value={keyword}
								onChange={(event) => setKeyword(event.target.value)}
								onFocus={() => {
									const viewport = scrollContainerRef.current
									const section = libraryRef.current
									if (viewport && section)
										viewport.scrollTop +=
											section.getBoundingClientRect().top -
											viewport.getBoundingClientRect().top
								}}
								onKeyDown={(event) => {
									if (event.key === "Escape") setKeyword("")
								}}
								placeholder={t("microAppsPage.searchPlaceholder")}
								aria-label={t("microAppsPage.searchPlaceholder")}
								className="h-9 rounded-xl bg-card/70 pl-9 pr-9"
								data-testid="micro-apps-search"
							/>
							{keyword ? (
								<button
									type="button"
									aria-label={t("microAppsPage.clearSearch")}
									onClick={() => setKeyword("")}
									className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								>
									<X className="size-4" />
								</button>
							) : null}
						</div>
						<Button
							type="button"
							variant="default"
							className="h-9 shrink-0 bg-black px-4 text-white hover:bg-black/90"
							onClick={createApp}
							disabled={!workspace?.id || creating}
							aria-label={t("microAppsPage.createApp")}
							title={t("microAppsPage.createApp")}
							aria-busy={creating}
							data-testid="micro-apps-gallery-create"
						>
							{creating ? (
								<Loader2 className="size-4 animate-spin" aria-hidden />
							) : (
								<Plus className="size-4" aria-hidden />
							)}
							{creating ? t("microAppsPage.creating") : t("microAppsPage.createApp")}
						</Button>
					</div>
				</div>

				{/* Keep both panels mounted so clearing search restores their pages and scroll positions. */}
				<div hidden={searching} className="min-h-0 flex-1">
					<MicroAppLibraryLayout
						development={
							<MicroAppLibraryPanel
								model={library}
								onChanged={accessLibrary.refresh}
							/>
						}
						access={
							<MicroAppLibraryPanel
								model={accessLibrary}
								access
								onChanged={library.refresh}
							/>
						}
					/>
				</div>
				{searching ? (
					<div className="min-h-0 flex-1">
						<MicroAppLibraryPanel
							model={searchLibrary}
							search
							onChanged={refreshLibraries}
						/>
					</div>
				) : null}
			</main>
		</ScrollArea>
	)
})

interface MicroAppsPageProps {
	mobileView?: "home" | "list"
}

export default function MicroAppsPage({ mobileView = "home" }: MicroAppsPageProps) {
	const isMobile = useIsMobile()

	if (isMobile) {
		return (
			<Suspense
				fallback={
					<div className="flex h-full w-full items-center justify-center bg-mobile-background">
						<Loader2 className="size-8 animate-spin text-muted-foreground" />
					</div>
				}
			>
				{mobileView === "list" ? <MicroAppsListPageMobile /> : <MicroAppsPageMobile />}
			</Suspense>
		)
	}

	return (
		<>
			<MicroAppsPageDesktop />
			{/*
			 * The "了解微应用创建流程" tour highlights the creation prompt and the app library of this
			 * page, so it is mounted alongside the desktop layout.
			 */}
			<GuideTourWrapper isMobile={false} page="micro-apps" />
		</>
	)
}

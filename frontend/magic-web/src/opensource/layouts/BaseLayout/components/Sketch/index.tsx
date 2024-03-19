import { MagicSpin } from "@/opensource/components/base"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { useTranslation } from "react-i18next"
import { Suspense, useRef } from "react"
import { routesMatch } from "@/opensource/routes/history/helpers"
import { baseHistory } from "@/opensource/routes/history"
import { getRouteSketch } from "./getRouteSketch"
import { RouteName } from "@/opensource/routes/constants"
import { Skeleton } from "@/opensource/components/shadcn-ui/skeleton"
import { magic } from "@/opensource/enhance/magicElectron"
import { observer } from "mobx-react-lite"
import { sidebarStore } from "@/opensource/stores/layout"

const isElectron = magic?.env?.isElectron?.()

const SidebarSkeleton = observer(function SidebarSkeleton() {
	const { collapsed, COLLAPSED_WIDTH, width: sidebarPercentWidth, windowWidth } = sidebarStore
	const expandedWidthPx = Math.max(
		220,
		Math.min(420, Math.round((sidebarPercentWidth / 100) * windowWidth)),
	)

	return (
		<aside
			className="flex h-full shrink-0 flex-col bg-sidebar p-2"
			data-testid="base-layout-sketch-sidebar"
			data-state={collapsed ? "collapsed" : "expanded"}
			style={{ width: collapsed ? COLLAPSED_WIDTH : expandedWidthPx }}
		>
			{collapsed ? (
				<>
					<div className="flex items-center justify-center pb-1">
						<Skeleton className="size-9 rounded-md" />
					</div>

					<div className="my-2 h-px w-full bg-border/70" />

					<div className="flex flex-1 flex-col items-center gap-2">
						{Array.from({ length: 2 }).map((_, index) => (
							<Skeleton key={index} className="size-6 rounded-lg" />
						))}
					</div>

					<div className="my-2 h-px w-full bg-border/70" />

					<div className="flex items-center justify-center">
						<Skeleton className="size-9 rounded-lg" />
					</div>
				</>
			) : (
				<>
					<div className="flex h-10 items-center gap-2">
						<Skeleton className="h-8 flex-1 rounded-md" />
						<Skeleton className="size-8 rounded-md" />
					</div>

					<div className="my-2 h-px w-full bg-border/70" />

					<div className="mt-3 flex-1 space-y-2">
						{Array.from({ length: 3 }).map((_, index) => (
							<Skeleton key={index} className="h-6 w-full rounded-md" />
						))}
					</div>

					<div className="my-2 h-px w-full bg-border/70" />

					<div className="space-y-2">
						<Skeleton className="h-8 w-full rounded-md" />
						<Skeleton className="h-8 w-full rounded-md" />
					</div>
				</>
			)}
		</aside>
	)
})

function Sketch() {
	const isMobile = useIsMobile()
	const { t } = useTranslation("interface")

	const currentRouteName = useRef(routesMatch(baseHistory.location.pathname)?.route.name)

	const CurrentRouteSketch = getRouteSketch(
		currentRouteName.current as RouteName | undefined,
		isMobile ? "mobile" : "desktop",
	)

	if (!CurrentRouteSketch) {
		return (
			<MagicSpin spinning tip={t("spin.loadingConfig")}>
				<div className="h-screen" />
			</MagicSpin>
		)
	}

	if (isMobile) {
		return (
			<Suspense fallback={null}>
				<CurrentRouteSketch />
			</Suspense>
		)
	}

	return (
		<div className="flex h-screen w-full flex-col bg-sidebar" data-testid="base-layout-sketch">
			{isElectron && (
				<div
					className="flex h-10 items-center justify-between px-3"
					data-testid="base-layout-sketch-electron-header"
				>
					<Skeleton className="h-6 w-28 rounded-md" />
					<div className="flex items-center gap-2">
						<Skeleton className="size-6 rounded-sm" />
						<Skeleton className="size-6 rounded-sm" />
						<Skeleton className="size-6 rounded-sm" />
					</div>
				</div>
			)}

			<div className="flex min-h-0 flex-1">
				<SidebarSkeleton />
				<div className="flex min-w-0 flex-1 flex-col py-2 pl-0 pr-2">
					<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
						<main
							className="flex-1 overflow-auto"
							data-testid="base-layout-sketch-main-content"
						>
							<Suspense fallback={null}>
								<CurrentRouteSketch />
							</Suspense>
						</main>
					</div>
				</div>
			</div>
		</div>
	)
}

export default Sketch

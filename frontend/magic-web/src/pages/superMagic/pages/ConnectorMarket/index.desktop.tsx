import { useRef } from "react"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import MarketBackToTopButton from "@/pages/superMagic/pages/CrewMarket/components/MarketBackToTopButton"
import ConnectorLibrary from "./components/ConnectorLibrary"

export default function ConnectorMarketDesktopPage() {
	const scrollViewportRef = useRef<HTMLDivElement | null>(null)

	return (
		<div
			className="relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xs"
			data-testid="connector-market-page"
		>
			<ScrollArea
				className="min-h-0 flex-1 [&_[data-slot='scroll-area-viewport']>div]:!block"
				viewportRef={scrollViewportRef}
			>
				<div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-7">
					<div className="w-full min-w-0" data-testid="connector-market-content">
						<ConnectorLibrary scrollViewportRef={scrollViewportRef} />
					</div>
				</div>
			</ScrollArea>
			<MarketBackToTopButton
				viewportRef={scrollViewportRef}
				testId="connector-market-back-to-top"
			/>
		</div>
	)
}

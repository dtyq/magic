import { lazy, Suspense } from "react"
import { observer } from "mobx-react-lite"
import { Loader2 } from "lucide-react"
import { useIsMobile } from "@/hooks/useIsMobile"
import { ClawPlaygroundStoreProvider } from "./context"

const ClawDesktopPage = lazy(() => import("./index.desktop"))
const ClawMobilePage = lazy(() => import("./index.mobile"))

function ClawPlaygroundPage() {
	const isMobile = useIsMobile()

	return (
		<ClawPlaygroundStoreProvider>
			<Suspense
				fallback={
					<div className="flex h-full w-full items-center justify-center bg-background">
						<Loader2 className="size-8 animate-spin text-muted-foreground" />
					</div>
				}
			>
				{isMobile ? <ClawMobilePage /> : <ClawDesktopPage />}
			</Suspense>
		</ClawPlaygroundStoreProvider>
	)
}

export default observer(ClawPlaygroundPage)

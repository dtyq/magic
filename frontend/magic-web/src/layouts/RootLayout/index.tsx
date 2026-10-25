import { memo, Suspense } from "react"
import { Outlet } from "react-router-dom"
import MagicSpin from "@/components/base/MagicSpin"

function RootLayout() {
	return (
		<div className="size-full">
			<Suspense
				fallback={
					<div className="flex h-[90vh] w-full flex-1 flex-col items-center justify-center">
						<MagicSpin spinning />
					</div>
				}
			>
				<Outlet />
			</Suspense>
		</div>
	)
}

export default memo(RootLayout)

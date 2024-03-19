import * as React from "react"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import { cx } from "antd-style"

export const ImageOverlay = React.memo(() => {
	return (
		<div
			className={cx(
				"flex flex-row items-center justify-center",
				"absolute inset-0 rounded bg-[var(--mt-overlay)] opacity-100 transition-opacity",
			)}
		>
			<MagicSpin spinning className="size-7" />
		</div>
	)
})

ImageOverlay.displayName = "ImageOverlay"

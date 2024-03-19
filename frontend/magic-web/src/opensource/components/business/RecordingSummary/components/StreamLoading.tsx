import { cx } from "antd-style"
import streamLoadingIcon from "@/opensource/assets/resources/stream-loading-2.png"
import { memo } from "react"

function StreamLoading({ size = 20, className }: { size?: number; className?: string }) {
	return (
		<img
			src={streamLoadingIcon}
			alt="loading"
			className={cx(className)}
			style={{ width: size, height: size }}
		/>
	)
}

export default memo(StreamLoading)

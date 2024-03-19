import { useControllableValue, useHover } from "ahooks"
import { useThemeMode } from "antd-style"
import { useTranslation } from "react-i18next"
import { IconCheck, IconCopy } from "@tabler/icons-react"
import useClipboard from "react-use-clipboard"

import MagicButton from "@/opensource/components/base/MagicButton"
import type { HTMLAttributes } from "react"
import { memo, useMemo, useRef, useEffect, useState } from "react"
import { calculateRelativeSize } from "@/opensource/utils/styles"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { useMessageRenderContext } from "@/opensource/components/business/MessageRenderProvider/hooks"
import { useFontSize } from "@/opensource/providers/AppearanceProvider/hooks"
import { useHighlight } from "./hooks/useHighlight"
import { useStyles } from "./style"

interface MagicCodeProps extends Omit<HTMLAttributes<HTMLDivElement>, "value" | "onChange"> {
	data?: string
	language?: string
	theme?: "dark" | "light"
	isStreaming?: boolean
	onChange?: (value: string) => void
	copyText?: string
}

// 检测是否为触摸设备
const isTouchDevice = () => {
	return "ontouchstart" in window || navigator.maxTouchPoints > 0
}

const MagicCode = memo((props: MagicCodeProps) => {
	const {
		data: value,
		onChange,
		theme,
		language,
		className,
		isStreaming = false,
		copyText,
		...rest
	} = props
	const [controllableValue] = useControllableValue<string>({
		value,
		onChange,
	})

	const { hiddenDetail } = useMessageRenderContext()

	const [isCopied, setCopied] = useClipboard(controllableValue, {
		successDuration: 1500,
	})

	const { t } = useTranslation("interface")

	const { appearance } = useThemeMode()

	const { styles, cx } = useStyles()

	const { fontSize } = useFontSize()

	const iconSize = useMemo(() => calculateRelativeSize(16, fontSize), [fontSize])

	const { data, isLoading } = useHighlight(
		controllableValue,
		language,
		(appearance ?? theme) === "dark",
	)

	const codeContainer = useRef(null)
	const isHover = useHover(codeContainer)

	// 在触摸设备上，使用不同的显示逻辑
	const [isTouchDeviceState, setIsTouchDeviceState] = useState(false)

	useEffect(() => {
		setIsTouchDeviceState(isTouchDevice())
	}, [])

	// 在触摸设备上，按钮应该始终显示（除非正在流式传输）
	// 在桌面设备上，按钮在hover时显示
	const shouldShowButton = isTouchDeviceState ? !isStreaming : isHover && !isStreaming

	if (!controllableValue) {
		return null
	}

	if (hiddenDetail) {
		return t("chat.message.placeholder.code")
	}

	return (
		<div
			className={cx(styles.container, language ? `language-${language}` : "", className)}
			ref={codeContainer}
			{...rest}
		>
			<MagicButton
				hidden={!shouldShowButton}
				type="text"
				className={cx(styles.copy, "magic-code-copy")}
				onClick={setCopied}
				size="small"
				icon={
					<MagicIcon
						color="currentColor"
						component={isCopied ? IconCheck : IconCopy}
						size={iconSize}
					/>
				}
			>
				{copyText ?? t("chat.markdown.copy")}
			</MagicButton>
			{isLoading || isStreaming ? (
				<code className={cx(styles.inner, styles.raw)}>{controllableValue?.trim()}</code>
			) : (
				<div
					className={styles.inner}
					dangerouslySetInnerHTML={{
						__html: data as string,
					}}
				/>
			)}
		</div>
	)
})

export default MagicCode

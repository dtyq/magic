import { useControllableValue, useHover } from "ahooks"
import { useThemeMode } from "antd-style"
import { useTranslation } from "react-i18next"
import { IconCheck, IconCopy } from "@tabler/icons-react"
import { WrapText } from "lucide-react"
import useClipboard from "react-use-clipboard"

import MagicButton from "@/components/base/MagicButton"
import type { HTMLAttributes } from "react"
import { memo, useMemo, useRef, useEffect, useState } from "react"
import { calculateRelativeSize } from "@/utils/styles"
import MagicIcon from "@/components/base/MagicIcon"
import { useMessageRenderContext } from "@/components/business/MessageRenderProvider/hooks"
import { useFontSize } from "@/providers/AppearanceProvider/hooks"
import { useHighlight } from "./hooks/useHighlight"
import { useStyles } from "./style"
import { useCodeBlockWrapPreference } from "@/services/markdown/codeBlockWrapPreference"
import { escapeCodeHtml, highlightCodeHtml, type CodeSearchHighlight } from "./search-highlights"

const EMPTY_SEARCH_HIGHLIGHTS: CodeSearchHighlight[] = []

interface MagicCodeProps extends Omit<HTMLAttributes<HTMLDivElement>, "value" | "onChange"> {
	data?: string
	language?: string
	theme?: "dark" | "light"
	isStreaming?: boolean
	onChange?: (value: string) => void
	copyText?: string
	enableWrapToggle?: boolean
	searchHighlights?: CodeSearchHighlight[]
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
		enableWrapToggle = false,
		searchHighlights = EMPTY_SEARCH_HIGHLIGHTS,
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
	const { isWrapped, toggle: toggleWrap } = useCodeBlockWrapPreference(enableWrapToggle)
	const wrapLabel = t("chat.markdown.wrapCode")
	const unwrapLabel = t("chat.markdown.unwrapCode")
	const wrapActionLabel = isWrapped ? unwrapLabel : wrapLabel
	const copyLabel = copyText ?? t("chat.markdown.copy")

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
	const highlightedHtml = useMemo(() => {
		// Use the same untrimmed source while syntax highlighting loads so offsets stay valid.
		const html =
			isLoading || isStreaming
				? `<pre><code>${escapeCodeHtml(controllableValue ?? "")}</code></pre>`
				: (data as string)
		return html ? highlightCodeHtml(html, searchHighlights, controllableValue) : ""
	}, [controllableValue, data, isLoading, isStreaming, searchHighlights])
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
			{shouldShowButton ? (
				<div className={styles.actions}>
					{enableWrapToggle ? (
						<MagicButton
							type="text"
							className={cx(styles.action, "magic-code-wrap")}
							onClick={toggleWrap}
							size="small"
							aria-label={wrapActionLabel}
							aria-pressed={isWrapped}
							tip={wrapActionLabel}
							icon={<WrapText size={iconSize} />}
						>
							{enableWrapToggle ? null : wrapActionLabel}
						</MagicButton>
					) : null}
					<MagicButton
						type="text"
						className={cx(styles.action, "magic-code-copy")}
						onClick={setCopied}
						size="small"
						aria-label={copyLabel}
						tip={copyLabel}
						icon={
							<MagicIcon
								color="currentColor"
								component={isCopied ? IconCheck : IconCopy}
								size={iconSize}
							/>
						}
					>
						{enableWrapToggle ? null : copyLabel}
					</MagicButton>
				</div>
			) : null}
			{(isLoading || isStreaming) && !searchHighlights.length ? (
				<code
					className={cx(
						styles.inner,
						styles.raw,
						enableWrapToggle && (isWrapped ? styles.codeWrapped : styles.codeUnwrapped),
					)}
				>
					{controllableValue?.trim()}
				</code>
			) : (
				<div
					className={cx(
						styles.inner,
						enableWrapToggle && (isWrapped ? styles.codeWrapped : styles.codeUnwrapped),
					)}
					dangerouslySetInnerHTML={{
						__html: highlightedHtml,
					}}
				/>
			)}
		</div>
	)
})

export default MagicCode

import { useControllableValue, useHover } from "ahooks"
import { cx, useThemeMode } from "antd-style"
import { useTranslation } from "react-i18next"
import { IconCheck, IconCopy } from "@tabler/icons-react"
import useClipboard from "react-use-clipboard"

import MagicButton from "@/opensource/components/base/MagicButton"
import type { HTMLAttributes } from "react"
import { memo, useMemo, useRef } from "react"
import { calculateRelativeSize } from "@/utils/styles"
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
				hidden={!isHover || isStreaming}
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
					// eslint-disable-next-line react/no-danger
					dangerouslySetInnerHTML={{
						__html: data as string,
					}}
				/>
			)}
		</div>
	)
})

export default MagicCode

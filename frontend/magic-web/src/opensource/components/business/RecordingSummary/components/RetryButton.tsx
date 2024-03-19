import MagicButton from "@/opensource/components/base/MagicButton"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconCheck, IconReload, IconX } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import { useMemo, useState } from "react"
import LoadingIcon from "./LoadingIcon"
import { useTheme } from "antd-style"
import { useTranslation } from "react-i18next"

function RetryButton({
	isRetrying,
	onRetryVoiceService,
}: {
	isRetrying: boolean
	onRetryVoiceService: () => Promise<void>
}) {
	const [status, setStatus] = useState<"init" | "loading" | "success" | "error">("init")
	const { t } = useTranslation("super")
	const { magicColorUsages } = useTheme()

	const handleRetry = useMemoizedFn(() => {
		setStatus("loading")
		onRetryVoiceService()
			.then(() => {
				setStatus("success")
			})
			.catch(() => {
				setStatus("error")
			})
			.finally(() => {
				setTimeout(() => {
					setStatus("init")
				}, 1500)
			})
	})

	const Icon = useMemo(() => {
		if (status === "loading") {
			return <LoadingIcon size={16} color={magicColorUsages.fill[2]} />
		}
		if (status === "success") {
			return (
				<MagicIcon
					component={IconCheck}
					size={16}
					color={magicColorUsages.success.default}
				/>
			)
		}
		if (status === "error") {
			return <MagicIcon component={IconX} size={16} color={magicColorUsages.danger.default} />
		}
		return <MagicIcon component={IconReload} size={16} />
	}, [
		magicColorUsages.danger.default,
		magicColorUsages.fill,
		magicColorUsages.success.default,
		status,
	])

	return (
		<MagicButton
			type="link"
			size="small"
			tip={t("recordingSummary.actions.retryTip")}
			onClick={handleRetry}
			loading={isRetrying}
			disabled={isRetrying}
		>
			{Icon}
		</MagicButton>
	)
}

export default RetryButton

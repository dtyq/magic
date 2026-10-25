import { memo } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { Copy } from "lucide-react"
import { cn } from "@/utils/cn"
import MagicModal from "@/components/base/MagicModal"
import type { SharePasswordFieldProps } from "./types"

export default memo(function SharePasswordField(props: SharePasswordFieldProps) {
	const { password, onCopy, onReset, showLabel = true } = props

	const { t } = useTranslation("super")

	const handleResetClick = (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()
		if (onReset) {
			MagicModal.confirm({
				title: t("share.resetPassword"),
				content: t("share.resetPasswordConfirm"),
				okText: t("button.confirm", { ns: "interface" }),
				onOk: () => {
					onReset()
				},
				zIndex: 1500,
			})
		}
	}

	return (
		<div className="flex flex-col gap-2" data-testid="share-password-field">
			{showLabel && (
				<label className="text-sm font-medium leading-none text-foreground" data-testid="share-password-field-label">
					{t("share.accessPassword")}
				</label>
			)}
			<div className="flex items-center gap-2" data-testid="share-password-actions">
				{/* 密码输入框和复制按钮组合 */}
				<div className="flex flex-1 items-center gap-0">
					<Input
						value={password}
						readOnly
						className={cn(
							"h-9 flex-1 rounded-r-none border-r-0",
							"border-input focus-visible:border-input focus-visible:ring-0 focus-visible:ring-offset-0",
						)}
						data-testid="share-password-field-input"
					/>
					<Button
						variant="outline"
						size="icon"
						className="h-9 w-9 rounded-l-none border-l"
						onClick={onCopy}
						data-testid="on-copy"
					>
						<Copy className="h-4 w-4" />
					</Button>
				</div>
				{/* 重置密码按钮 - 可选 */}
				{onReset && (
					<Button
						variant="outline"
						size="default"
						className="h-9 min-w-20"
						onClick={handleResetClick}
						data-testid="handle-reset-click"
					>
						{t("share.resetPassword")}
					</Button>
				)}
			</div>
		</div>
	)
})

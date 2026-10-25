import { useState } from "react"
import { useCountDown, useThrottleEffect } from "ahooks"
import { useTranslation } from "react-i18next"
import { FlowApi } from "@/apis"
import MagicLoading from "@/components/other/MagicLoading"
import { logger as Logger } from "@/infrastructure/logger"

const logger = Logger.createLogger("MCPAuthCallback")

export default function Auth() {
	const { t } = useTranslation("interface")

	const [targetDate, setTargetDate] = useState<number>()
	const [loading, setLoading] = useState(true)
	const [isSuccess, setSuccess] = useState<boolean>(false)

	const [countdown] = useCountDown({
		targetDate: targetDate,
		onEnd: () => {
			window.close()
		},
	})

	useThrottleEffect(
		() => {
			const init = async () => {
				const url = new URL(window.location.href)
				const code = url.searchParams.get("code")
				const state = url.searchParams.get("state")
				try {
					if (!code || !state) {
						throw new Error("params error")
					}
					await FlowApi.bindMCPOAuth(code, state)
					setSuccess(true)
					setTargetDate(Date.now() + 3000)
				} catch (error) {
					logger.error({
						eventKey: "mcp_oauth_callback_failed",
						errorKind: !code || !state ? "validation" : "request",
						error,
						message: "MCP OAuth callback failed",
						// Record only parameter presence to keep OAuth authorization codes and state out of the log context.
						context: { hasCode: Boolean(code), hasState: Boolean(state) },
					})
					setSuccess(false)
				} finally {
					setLoading(false)
				}
			}
			init()
		},
		[],
		{ wait: 500, leading: false },
	)

	return (
		<div className="flex h-full w-full flex-col items-center justify-center gap-10">
			{loading ? (
				<div className="flex size-[60px] flex-none items-center justify-center">
					<div className="size-[60px]">
						<MagicLoading />
					</div>
				</div>
			) : (
				<div className="flex size-[60px] flex-none items-center justify-center">
					{isSuccess ? (
						<svg className="size-full" viewBox="0 0 1024 1024" aria-hidden="true">
							<path
								d="M824.533333 217.770667c-194.901333 124.714667-336.128 281.6-399.786666 360.618666l-155.221334-127.189333-68.821333 57.6 268.458667 285.269333c46.464-123.52 192.853333-365.098667 371.754666-536.746666l-16.384-39.509334zM512 1024C229.248 1024 0 794.794667 0 512S229.248 0 512 0c282.794667 0 512 229.205333 512 512s-229.205333 512-512 512z"
								fill="#67C23A"
							/>
						</svg>
					) : (
						<svg className="size-full" viewBox="0 0 1024 1024" aria-hidden="true">
							<path
								d="M721.877333 303.104a48.469333 48.469333 0 0 0-68.437333 0l-141.909333 141.909333-136.277334-136.234666a46.933333 46.933333 0 1 0-66.432 66.432l136.277334 136.277333-141.952 141.952a48.384 48.384 0 0 0 68.394666 68.352l141.952-141.909333 137.045334 137.002666a46.933333 46.933333 0 1 0 66.432-66.432l-137.045334-137.002666 141.952-141.952a48.469333 48.469333 0 0 0 0-68.394667M512 1024C229.248 1024 0 794.752 0 512 0 229.205333 229.248 0 512 0c282.794667 0 512 229.205333 512 512 0 282.752-229.205333 512-512 512"
								fill="#FA5555"
							/>
						</svg>
					)}
				</div>
			)}
			{!loading && (
				<div className="flex flex-col items-center gap-1">
					<div className="text-center text-[32px] font-semibold not-italic leading-[44px] text-foreground">
						{t(isSuccess ? "oauth.successTitle" : "oauth.failTitle")}
					</div>
					<div className="w-[182px] text-center text-sm font-normal not-italic leading-5 text-foreground/60">
						{t(isSuccess ? "oauth.successDesc" : "oauth.failDesc", {
							count: Math.round(countdown / 1000),
						})}
					</div>
				</div>
			)}
		</div>
	)
}

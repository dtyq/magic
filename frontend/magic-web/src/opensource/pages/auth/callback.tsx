import { createStyles } from "antd-style"
import { useState } from "react"
import AuthSuccessBg from "@/opensource/assets/resources/auth-success-bg.png"
import AuthFailsBg from "@/opensource/assets/resources/auth-fail-bg.png"
import { useCountDown, useThrottleEffect } from "ahooks"
import { useTranslation } from "react-i18next"
import { FlowApi } from "@/opensource/apis"
import MagicLoading from "@/opensource/components/other/MagicLoading"

const useStyles = createStyles(({ css, token }) => ({
	layout: css`
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 40px;
		justify-content: center;
		align-items: center;
	`,
	icon: css`
		width: 240px;
		height: 240px;
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
	`,
	image: css`
		width: 100%;
		height: 100%;
	`,
	loading: css`
		width: 60px;
		height: 60px;
	`,
	wrapper: css`
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	`,
	title: css`
		color: ${token.magicColorUsages.text[0]};
		text-align: center;
		font-size: 32px;
		font-style: normal;
		font-weight: 600;
		line-height: 44px; /* 137.5% */
	`,
	desc: css`
		width: 182px;
		color: ${token.magicColorUsages.text[2]};
		text-align: center;
		font-size: 14px;
		font-style: normal;
		font-weight: 400;
		line-height: 20px; /* 142.857% */
	`,
}))

export default function Auth() {
	const { styles } = useStyles()
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
					const aa = await FlowApi.bindMCPOAuth(code || "", state || "")
					setSuccess(true)
					setTargetDate(Date.now() + 3000)
					console.log("=======>", aa)
				} catch (error) {
					console.log("oauth 2.0 fail", error)
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
		<div className={styles.layout}>
			{loading ? (
				<div className={styles.icon}>
					<div className={styles.loading}>
						<MagicLoading />
					</div>
				</div>
			) : (
				<div className={styles.icon}>
					<img
						src={isSuccess ? AuthSuccessBg : AuthFailsBg}
						className={styles.image}
						alt=""
					/>
				</div>
			)}
			{!loading && (
				<div className={styles.wrapper}>
					<div className={styles.title}>
						{t(isSuccess ? "oauth.successTitle" : "oauth.failTitle")}
					</div>
					<div className={styles.desc}>
						{t(isSuccess ? "oauth.successDesc" : "oauth.failDesc", {
							count: Math.round(countdown / 1000),
						})}
					</div>
				</div>
			)}
		</div>
	)
}

import type { MagicButtonProps } from "@/components/base/MagicButton"
import MagicButton from "@/components/base/MagicButton"
import { VerificationCode } from "@/constants/bussiness"
import { useCountDown, useMemoizedFn, useUpdateEffect } from "ahooks"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"

interface VerificationCodeButtonProps extends MagicButtonProps {
	/** 国家区号 */
	stateCode?: string
	/** 手机号 */
	phone?: string
	/** 验证码类型 */
	codeType: VerificationCode
	/** 倒计时 */
	during?: number
	/** 禁用 */
	disabled?: boolean
	/** 自动获取 */
	autoFetch?: boolean
	/** 发送触发 */
	trigger?: (
		codeType: VerificationCode,
		phone: string,
		stateCode?: string,
		token?: string,
	) => Promise<void>
	/** 图形验证码 token */
	captchaToken?: string
	/** 发送前回调，用于在非首次发送时获取新的图形验证码 token */
	onBeforeSend?: () => Promise<string | undefined>
}

/**
 * 获取手机验证码按钮
 * @param param0isNotFirstSend
 * @returns
 */
function VerificationCodeButton({
	stateCode,
	phone,
	disabled = false,
	codeType,
	during = 60,
	hidden = false,
	autoFetch = false,
	trigger,
	onBeforeSend,
	captchaToken,
	className,
	...props
}: VerificationCodeButtonProps) {
	const { t } = useTranslation("interface")
	const { t: loginT } = useTranslation("login")
	const [targetDate, setTargetDate] = useState<number>()
	const [countdown] = useCountDown({ targetDate })
	const [sendTimes, setSendTimes] = useState(0)
	const [isFetching, setIsFetching] = useState(false)

	/** 是否在倒计时中 */
	const isWaiting = countdown > 0

	/** 是否不是第一次发送 */
	const isNotFirstSend = sendTimes > 0

	const sendCodeTrigger = useMemoizedFn(async () => {
		if (codeType !== VerificationCode.DeviceLogout && !phone) {
			magicToast.error(t("form.phoneRequired", { ns: "message" }))
			return
		}
		try {
			setIsFetching(true)

			// 如果不是第一次发送，需要先获取新的图形验证码 token
			let tokenToUse = captchaToken
			if (isNotFirstSend && onBeforeSend) {
				const newToken = await onBeforeSend()
				if (!newToken) {
					return
				}
				tokenToUse = newToken
			}

			setSendTimes((s) => s + 1)
			await trigger?.(codeType, phone || "", stateCode, tokenToUse)
			setTargetDate(Date.now() + during * 1000)
		} catch (err) {
			console.error(err)
		} finally {
			setIsFetching(false)
		}
	})

	// 当 phone 发生变化时，重置 sendTimes 和 targetDate
	useUpdateEffect(() => {
		if (phone) {
			setSendTimes(0)
			setTargetDate(undefined)
		}
	}, [phone])

	// 如果 autoFetch 为 true，并且不是第一次发送，则自动发送验证码
	useEffect(() => {
		if (!hidden && autoFetch && !isNotFirstSend) {
			sendCodeTrigger()
		}
	}, [hidden, autoFetch, sendCodeTrigger, isNotFirstSend])

	/**
	 * 手机号或国家区号变化时，重置发送次数和倒计时
	 */
	useUpdateEffect(() => {
		if (phone && stateCode) {
			setSendTimes(0)
			setTargetDate(undefined)
		}
	}, [phone, stateCode])

	const text = useMemo(() => {
		if (isFetching) {
			return null
		}

		if (isWaiting) {
			return loginT("afterSecondsCan", {
				seconds: Math.ceil(countdown / 1000),
			})
		}

		return isNotFirstSend ? loginT("reSendVerificationCode") : loginT("sendVerificationCode")
	}, [isFetching, isWaiting, loginT, countdown, isNotFirstSend])

	return (
		<MagicButton
			type="primary"
			onClick={sendCodeTrigger}
			disabled={disabled || countdown > 0}
			hidden={hidden}
			loading={isFetching}
			className={className}
			data-testid="verification-code-button"
			{...props}
		>
			{text}
		</MagicButton>
	)
}

export default VerificationCodeButton

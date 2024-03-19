import ShareIcon from "@/opensource/pages/share/assets/icon/replay_icon.svg"
import { Button, Input } from "antd"
import { createStyles } from "antd-style"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

// Define the styles using createStyles
const useStyles = createStyles(({ token }) => {
	return {
		container: {
			width: "100%",
			height: "100%",
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			justifyContent: "center",
			padding: "32px",
			maxWidth: "400px",
			margin: "0 auto",
		},
		icon: {
			width: "60px",
			height: "60px",
			margin: "0 auto 20px",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			borderRadius: "50%",
			backgroundColor: token.magicColorUsages.primaryLight.default,
		},
		title: {
			fontSize: "18px",
			fontWeight: "500",
			marginBottom: "16px",
			color: token.magicColorUsages.text[0],
		},
		description: {
			fontSize: "14px",
			color: token.magicColorUsages.text[1],
			marginBottom: "24px",
		},
		inputContainer: {
			display: "flex",
			alignItems: "center",
			width: "100%",
			marginBottom: "16px",
		},
		input: {
			flex: 1,
			marginRight: "8px",
		},
		button: {
			backgroundColor: token.magicColorUsages.primary.default,
			borderColor: token.magicColorUsages.primary.default,
			"&:hover": {
				backgroundColor: token.magicColorUsages.primary.hover,
				borderColor: token.magicColorUsages.primary.hover,
			},
		},
	}
})

const STORAGE_KEY_PREFIX = "share_password_"

interface PasswordVerificationProps {
	resourceId: string
	initialPassword?: string
	onVerifySuccess: (data: any, password?: string) => void
	onVerifyFail?: (error: any) => void
	getShareData: (params: { resource_id: string; password?: string }) => Promise<any>
	isFileShare?: boolean
}

export default function PasswordVerification({
	resourceId,
	initialPassword = "",
	onVerifySuccess,
	onVerifyFail,
	getShareData,
	isFileShare = false,
}: PasswordVerificationProps) {
	const [password, setPassword] = useState(initialPassword)
	const [loading, setLoading] = useState(false)
	const { styles } = useStyles()
	const { t } = useTranslation("super")

	// 处理密码输入变化
	const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		// 转换为大写并限制长度为6
		const value = e.target.value.toUpperCase().slice(0, 6)
		setPassword(value)
	}

	// 存储密码到 sessionStorage
	const savePasswordToStorage = (resourceIdToSave: string, passwordToSave: string) => {
		try {
			sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${resourceIdToSave}`, passwordToSave)
		} catch (e) {
			console.error("保存密码到 sessionStorage 失败", e)
		}
	}

	// 从 sessionStorage 获取密码
	const getPasswordFromStorage = (resourceIdToGet: string): string | null => {
		try {
			return sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${resourceIdToGet}`)
		} catch (e) {
			console.error("从 sessionStorage 获取密码失败", e)
			return null
		}
	}

	// 处理验证按钮点击
	const handleVerify = useCallback(async () => {
		if (!password) return

		try {
			setLoading(true)
			const result = await getShareData({ resource_id: resourceId, password })

			if (result) {
				// 成功验证后保存密码
				savePasswordToStorage(resourceId, password)
				// 传递密码给父组件
				onVerifySuccess(result, password)
			}
		} catch (error) {
			onVerifyFail?.(error)
		} finally {
			setLoading(false)
		}
	}, [password, resourceId, onVerifySuccess, onVerifyFail, getShareData])

	// 自动验证初始密码或从 sessionStorage 中获取密码进行验证
	useEffect(() => {
		const tryVerifyWithStoredPassword = async () => {
			// 如果已有初始密码，则使用初始密码验证
			if (initialPassword) {
				return
			}

			// 没有初始密码时，尝试从 sessionStorage 获取
			const storedPassword = getPasswordFromStorage(resourceId)
			if (storedPassword && !password) {
				setPassword(storedPassword)
				try {
					setLoading(true)
					const result = await getShareData({
						resource_id: resourceId,
						password: storedPassword,
					})
					if (result) {
						// 传递密码给父组件
						onVerifySuccess(result, storedPassword)
					}
				} catch (error) {
					// 验证失败，不做处理，用户需要手动输入密码
					console.log("使用存储的密码验证失败，需要用户手动输入")
				} finally {
					setLoading(false)
				}
			}
		}

		tryVerifyWithStoredPassword()
	}, [resourceId, initialPassword, onVerifySuccess, password])

	// 单独处理初始密码验证
	useEffect(() => {
		if (initialPassword) {
			handleVerify()
		}
	}, [initialPassword, handleVerify])

	// 处理按下回车键
	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			handleVerify()
		}
	}

	const title = isFileShare
		? t("share.passwordVerification.fileTitle")
		: t("share.passwordVerification.replayTitle")
	const description = isFileShare
		? t("share.passwordVerification.fileDescription")
		: t("share.passwordVerification.replayDescription")

	return (
		<div className={styles.container}>
			<div className={styles.icon}>
				<img src={ShareIcon} alt="" />
			</div>
			<div className={styles.title}>{title}</div>
			<div className={styles.description}>{description}</div>
			<div className={styles.inputContainer}>
				<Input
					className={styles.input}
					placeholder={t("share.accessPassword")}
					value={password}
					onChange={handlePasswordChange}
					onKeyDown={handleKeyDown}
					maxLength={6}
					autoFocus
				/>
				<Button
					type="primary"
					className={styles.button}
					onClick={handleVerify}
					loading={loading}
				>
					{t("common.confirm")}
				</Button>
			</div>
		</div>
	)
}

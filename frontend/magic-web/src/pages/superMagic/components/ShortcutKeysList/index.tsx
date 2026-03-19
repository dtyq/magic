import { memo, useEffect, useRef, useState } from "react"
import { IconKeyboard, IconX } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { getShortcutKeysData, ShortcutActions } from "./constants"
import type { ShortcutKeyGroup } from "./constants"
import { useRegisterShortcut, useRegisterContext } from "../../hooks/useGlobalShortcuts"
import useStyles from "./styles"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { cx } from "antd-style"
import ShortcutKey from "./components/ShortcutKey"

function ShortcutKeysList() {
	const { t } = useTranslation("super")
	const { styles } = useStyles()
	const modalRef = useRef<HTMLDivElement>(null)
	const [visible, setVisible] = useState(false)

	const shortcutKeysData = getShortcutKeysData(t)

	// 处理打开弹窗
	const handleOpen = () => {
		setVisible(true)
	}

	// 处理关闭弹窗
	const handleClose = () => {
		setVisible(false)
	}

	// 渲染快捷键项
	const renderShortcutKey = (keys: string[]) => {
		return <ShortcutKey keys={keys} />
	}

	// 渲染快捷键组
	const renderShortcutGroup = (group: ShortcutKeyGroup) => {
		return (
			<div className={styles.shortcutGroup} key={group.title}>
				<div className={styles.groupTitle}>{group.title}</div>
				<div className={styles.groupSubTitle}>
					<div>{t("shortcut.operation")}</div>
					<div className={styles.shortcutKeys}>{t("shortcut.shortcutKeys")}</div>
				</div>
				<div>
					{group.keys.map((item, index) => (
						<div className={styles.shortcutItem} key={index}>
							<div className={styles.shortcutOperation}>{item.name}</div>
							{renderShortcutKey(item.keys)}
						</div>
					))}
				</div>
			</div>
		)
	}

	// 注册弹窗状态为上下文，供快捷键处理函数使用
	useRegisterContext("shortcutKeysPanel", () => ({
		visible,
		handleOpen,
		handleClose,
	}))

	// 注册快捷键 - 使用上下文获取最新状态
	useRegisterShortcut(ShortcutActions.VIEW_SHORTCUTS, (context) => {
		const panel = context.shortcutKeysPanel
		if (panel?.visible) {
			panel.handleClose()
		} else {
			panel?.handleOpen()
		}
	})

	// 自动聚焦到弹窗
	useEffect(() => {
		if (visible && modalRef.current) {
			// 添加小延时确保DOM完全渲染
			const timer = setTimeout(() => {
				modalRef.current?.focus()
			}, 50)

			return () => clearTimeout(timer)
		}
	}, [visible])

	// 全局键盘事件监听
	useEffect(() => {
		const handleGlobalKeyDown = (e: KeyboardEvent) => {
			if (visible && e.key === "Escape") {
				handleClose()
			}
		}

		if (visible) {
			document.addEventListener("keydown", handleGlobalKeyDown)
		}

		return () => {
			document.removeEventListener("keydown", handleGlobalKeyDown)
		}
	}, [visible])

	// 处理点击外部关闭
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
				handleClose()
			}
		}

		if (visible) {
			document.addEventListener("mousedown", handleClickOutside)
		}

		return () => {
			document.removeEventListener("mousedown", handleClickOutside)
		}
	}, [visible])

	// 订阅全局事件，用于清除超级麦吉的工作区状态缓存
	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Show_Shortcut_Keys, () => {
			setVisible((prev) => !prev)
		})
		return () => {
			pubsub?.unsubscribe(PubSubEvents.Show_Shortcut_Keys)
		}
	}, [])

	return (
		<div className={styles.container}>
			<div className={cx(styles.modal, !visible && styles.modalHidden)} ref={modalRef}>
				<div className={styles.header}>
					<div className={styles.headerLeft}>
						<div className={styles.headerLeftIcon}>
							<IconKeyboard size={24} stroke={1.5} />
						</div>
						<div className={styles.title}>{t("shortcut.shortcutKeys")}</div>
					</div>
					<div className={styles.headerRight} onClick={handleClose}>
						<IconX size={24} stroke={1.5} />
					</div>
				</div>

				<div className={styles.content}>{shortcutKeysData.map(renderShortcutGroup)}</div>
			</div>
		</div>
	)
}

export default memo(ShortcutKeysList)

export { ShortcutKey }

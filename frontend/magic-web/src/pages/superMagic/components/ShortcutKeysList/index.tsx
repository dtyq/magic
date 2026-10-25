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
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"

function ShortcutKeysList() {
	const { t } = useTranslation("super")
	const { styles } = useStyles()
	const modalRef = useRef<HTMLDivElement>(null)
	const [visible, setVisible] = useState(false)

	const shortcutKeysData = getShortcutKeysData(t)

	// Open the shortcuts panel.
	const handleOpen = () => {
		setVisible(true)
	}

	// Close the shortcuts panel.
	const handleClose = () => {
		setVisible(false)
	}

	// Render shortcut keys.
	const renderShortcutKey = (keys: string[]) => {
		return <ShortcutKey keys={keys} />
	}

	// Render a shortcut group.
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

	// Expose current panel state to shortcut handlers.
	useRegisterContext("shortcutKeysPanel", () => ({
		visible,
		handleOpen,
		handleClose,
	}))

	// Read current panel state when the shortcut runs.
	useRegisterShortcut(ShortcutActions.VIEW_SHORTCUTS, (context) => {
		const panel = context.shortcutKeysPanel
		if (panel?.visible) {
			panel.handleClose()
		} else {
			panel?.handleOpen()
		}
	})

	// Focus the panel after opening.
	useEffect(() => {
		if (visible && modalRef.current) {
			// Wait for the panel DOM to render before focusing.
			const timer = setTimeout(() => {
				modalRef.current?.focus()
			}, 50)

			return () => clearTimeout(timer)
		}
	}, [visible])

	// Close the open panel on Escape.
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

	// Close on clicks outside the panel.
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

	// Toggle the panel from the shared shortcut event.
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
					<div
						className={styles.headerRight}
						onClick={handleClose}
						data-testid="handle-close"
					>
						<IconX size={24} stroke={1.5} />
					</div>
				</div>

				<ScrollArea className={styles.content} viewportClassName={styles.viewport}>
					{shortcutKeysData.map(renderShortcutGroup)}
				</ScrollArea>
			</div>
		</div>
	)
}

export default memo(ShortcutKeysList)

export { ShortcutKey }

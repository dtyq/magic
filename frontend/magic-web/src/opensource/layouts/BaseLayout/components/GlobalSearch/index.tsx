import type { ButtonProps } from "antd"
import { cx } from "antd-style"
import { useTranslation } from "react-i18next"
import { useKeyPress } from "ahooks"
import { isMac } from "@/opensource/utils/devices"
import type { MouseEvent, FocusEvent } from "react"
import { useCallback, useEffect } from "react"
import { useSearchStyles } from "./styles"
import SearchPanel from "./SearchPanel"
import { useMagicSearchStore } from "./store"
import MagicModal from "@/opensource/components/base/MagicModal"
import { MagicButton } from "@dtyq/magic-admin/components"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconSearch, IconX } from "@tabler/icons-react"
import FlexBox from "@/opensource/components/base/FlexBox"

function GlobalSearch({ className }: ButtonProps) {
	const { styles } = useSearchStyles()
	const { t } = useTranslation("search")
	const open = useMagicSearchStore((store) => store.open)

	const { openPanel, closePanel } = useMagicSearchStore((store) => {
		return {
			openPanel: store.openPanel,
			closePanel: store.closePanel,
		}
	})

	const searchWord = useMagicSearchStore((store) => store.searchWord)

	useKeyPress(isMac ? ["meta.k"] : ["ctrl.k"], openPanel, {})
	useKeyPress("esc", () => {
		closePanel()
	})

	useEffect(() => {
		if (open) {
			useMagicSearchStore.setState((preState) => {
				preState.searchWord = ""
			})
		}
	}, [open])

	const onClick = useCallback(
		(event: MouseEvent<HTMLInputElement> | FocusEvent<HTMLInputElement>) => {
			event?.stopPropagation()
			event?.preventDefault()
			openPanel()
		},
		[openPanel],
	)

	// 因视窗最小宽度问题，适配最大为视窗宽度一半
	const maxHeight = Math.min(window.innerHeight * 0.7, 600)

	return (
		<>
			<MagicButton onClick={openPanel} className={styles.button}>
				<MagicIcon component={IconSearch} size={24} />
			</MagicButton>
			<MagicModal
				// overlayClassName={cx(styles.popover)}
				open={open}
				onCancel={closePanel}
				footer={null}
				closeIcon={null}
				classNames={{
					body: styles.modalBody,
					content: styles.content,
				}}
				centered
			>
				<FlexBox align="center" justify="space-between" className={styles.header}>
					<MagicIcon
						component={IconSearch}
						className={styles.searchIcon}
						size={24}
						color="currentColor"
					/>
					<input
						value={searchWord}
						onClick={onClick}
						onFocus={onClick}
						onChange={(event) =>
							useMagicSearchStore.setState((preState) => {
								preState.searchWord = event?.target?.value
							})
						}
						className={cx(className, styles.input)}
						placeholder={t("quickSearch.searchPlaceholder")}
					/>
					<MagicIcon
						component={IconX}
						size={24}
						onClick={closePanel}
						className={styles.close}
					/>
				</FlexBox>
				<SearchPanel maxHeight={maxHeight} />
			</MagicModal>
		</>
	)
}

export default GlobalSearch

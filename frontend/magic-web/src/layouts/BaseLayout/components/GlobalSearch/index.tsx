import type { ButtonProps } from "antd"
import { cn } from "@/utils/cn"
import { useTranslation } from "react-i18next"
import { useKeyPress } from "ahooks"
import { isMac } from "@/utils/devices"
import type { MouseEvent, FocusEvent } from "react"
import { useCallback, useEffect } from "react"
import SearchPanel from "./SearchPanel"
import { useMagicSearchStore } from "./store"
import MagicModal from "@/components/base/MagicModal"
import { Button } from "@/components/shadcn-ui/button"
import MagicIcon from "@/components/base/MagicIcon"
import { IconSearch, IconX } from "@tabler/icons-react"

function GlobalSearch({ className }: ButtonProps) {
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
			<Button
				variant="ghost"
				onClick={openPanel}
				className="size-8 border-0 p-1.5"
				aria-label={t("quickSearch.searchPlaceholder")}
			>
				<MagicIcon component={IconSearch} size={24} />
			</Button>
			<MagicModal
				open={open}
				onCancel={closePanel}
				footer={null}
				closeIcon={null}
				classNames={{
					body: "overflow-hidden [--magic-modal-body-padding:0]",
					content: "overflow-hidden",
				}}
				centered
			>
				<div className="flex h-11 items-center justify-between border-b border-[var(--magic-color-border-secondary)]">
					<MagicIcon
						component={IconSearch}
						className="ml-5 mr-2.5 text-foreground/40"
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
						className={cn(
							"w-full border-0 bg-transparent shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
							className,
						)}
						placeholder={t("quickSearch.searchPlaceholder")}
					/>
					<Button
						variant="ghost"
						aria-label={t("button.close", { ns: "interface" })}
						onClick={closePanel}
						className="size-11 shrink-0 rounded-none border-l border-[var(--magic-color-border-secondary)] p-2.5"
					>
						<MagicIcon component={IconX} size={24} />
					</Button>
				</div>
				<SearchPanel maxHeight={maxHeight} />
			</MagicModal>
		</>
	)
}

export default GlobalSearch

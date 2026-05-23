import { Search, Check } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import type { Timezone } from "@dtyq/timezone"

import { useTranslation } from "react-i18next"

import { Input } from "@/components/shadcn-ui/input"
import { useTimezone, useTimezoneList } from "@/providers/TimezoneProvider/hooks"

import {
	MOBILE_SETTINGS_SECTION_CLASSNAME,
	MOBILE_SETTINGS_SHEET_HEIGHT_CLASSNAME,
} from "../constants"
import { MobileSettingsSheetContainer } from "./SheetContainer"

/** 时区子弹窗保留搜索与当前项滚动能力，避免从路由页迁移后损失已有可用性。 */
export function MobileSettingsAppSettingsTimezoneSheet(props: {
	open: boolean
	onClose: () => void
}) {
	const { open, onClose } = props
	const { t } = useTranslation("interface")
	const { timezone, setTimezone } = useTimezone()
	const { data: timezoneList } = useTimezoneList()
	const selectedItemRef = useRef<HTMLButtonElement | null>(null)
	const [searchQuery, setSearchQuery] = useState("")

	/** 搜索同时匹配 code / label / city，和旧路由页保持一致，减少迁移后的心智差异。 */
	const filteredTimezoneList = useMemo(() => {
		if (!timezoneList) return []
		if (!searchQuery.trim()) return timezoneList

		const query = searchQuery.toLowerCase()
		return timezoneList.filter(
			(timezoneItem) =>
				timezoneItem.city?.toLowerCase().includes(query) ||
				timezoneItem.code.toLowerCase().includes(query) ||
				timezoneItem.label?.toLowerCase().includes(query),
		)
	}, [searchQuery, timezoneList])

	useEffect(() => {
		if (!open) {
			setSearchQuery("")
		}
	}, [open])

	useEffect(() => {
		if (!open || searchQuery || !selectedItemRef.current) return

		/** 只在无搜索词时自动聚焦当前选中项，避免打开弹窗后用户找不到当前位置。 */
		const timer = window.setTimeout(() => {
			selectedItemRef.current?.scrollIntoView({
				block: "center",
				behavior: "smooth",
			})
		}, 100)

		return () => {
			window.clearTimeout(timer)
		}
	}, [filteredTimezoneList, open, searchQuery])

	/** 选中时区后立即写回用户资料，再关闭当前子弹窗回到应用设置父层。 */
	const handleTimezoneChange = useMemoizedFn(async (nextTimezone: Timezone.TimezoneCode) => {
		await setTimezone(nextTimezone)
		onClose()
	})

	return (
		<MobileSettingsSheetContainer
			open={open}
			title={t("setting.timezone")}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose()
			}}
			// 把固定高度落到 Sheet 本体上，避免结果变少时由内容高度反向把整张浮层压矮。
			sheetClassName={MOBILE_SETTINGS_SHEET_HEIGHT_CLASSNAME}
			contentClassName="h-full gap-2.5 px-[14px] pb-[calc(var(--safe-area-inset-bottom)+1rem)] pt-2"
			dataTestId="mobile-settings-app-timezone-sheet"
		>
			<div className="relative">
				<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					value={searchQuery}
					onChange={(event) => setSearchQuery(event.target.value)}
					placeholder={t("setting.searchPlaceholder")}
					className="h-10 rounded-xl border border-input bg-card pl-9 pr-3 text-sm shadow-none"
				/>
			</div>

			<div
				className={`${MOBILE_SETTINGS_SECTION_CLASSNAME} no-scrollbar min-h-0 flex-1 overflow-y-auto`}
			>
				{filteredTimezoneList.length === 0 ? (
					<div className="flex h-full items-center justify-center px-4 py-8 text-center text-sm text-muted-foreground">
						{t("setting.notFound")}
					</div>
				) : (
					filteredTimezoneList.map((timezoneItem, index) => {
						const selected = timezoneItem.code === timezone

						return (
							<div key={timezoneItem.code}>
								<button
									ref={selected ? selectedItemRef : null}
									type="button"
									onClick={() => handleTimezoneChange(timezoneItem.code)}
									className="flex h-12 w-full items-center gap-3 bg-transparent px-3.5 transition-opacity active:opacity-60"
									data-testid={`mobile-settings-timezone-option-${timezoneItem.code}`}
								>
									<span className="flex-1 text-left text-base leading-5 text-foreground">
										{timezoneItem.label}
									</span>
									{selected ? (
										<Check
											className="h-[18px] w-[18px] shrink-0 text-primary"
											strokeWidth={2.5}
										/>
									) : null}
								</button>
								{index < filteredTimezoneList.length - 1 ? (
									<div className="pl-3.5">
										<div className="h-px w-full bg-border" />
									</div>
								) : null}
							</div>
						)
					})
				)}
			</div>
		</MobileSettingsSheetContainer>
	)
}

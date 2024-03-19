import { ChevronLeft, Search } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useMemoizedFn } from "ahooks"
import { useNavigate } from "@/opensource/routes/hooks/useNavigate"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { Input } from "@/opensource/components/shadcn-ui/input"
import { useTranslation } from "react-i18next"
import { useTimezone, useTimezoneList } from "@/opensource/providers/TimezoneProvider/hooks"
import type { Timezone } from "@dtyq/timezone"
import { Checkbox } from "@/opensource/components/shadcn-ui/checkbox"
import { useEffect, useRef, useState, useMemo } from "react"

function TimezoneSelector() {
	const { t } = useTranslation("interface")
	const navigate = useNavigate()

	const { timezone, setTimezone } = useTimezone()
	const { data: timezoneList } = useTimezoneList()

	const selectedItemRef = useRef<HTMLDivElement>(null)
	const [searchQuery, setSearchQuery] = useState("")

	// 过滤时区列表
	const filteredTimezoneList = useMemo(() => {
		if (!timezoneList) return []
		if (!searchQuery.trim()) return timezoneList

		const query = searchQuery.toLowerCase()
		return timezoneList.filter(
			(tz) =>
				tz.city?.toLowerCase().includes(query) ||
				tz.code.toLowerCase().includes(query) ||
				tz.label?.toLowerCase().includes(query),
		)
	}, [timezoneList, searchQuery])

	// 自动滚动到选中项
	useEffect(() => {
		if (selectedItemRef.current && !searchQuery) {
			setTimeout(() => {
				selectedItemRef.current?.scrollIntoView({
					behavior: "smooth",
					block: "center",
				})
			}, 100)
		}
	}, [timezoneList, searchQuery])

	// 返回上一页
	const handleBack = useMemoizedFn(() => {
		navigate({
			delta: -1,
			viewTransition: {
				type: "slide",
				direction: "right",
			},
		})
	})

	const handleTimezoneChange = useMemoizedFn((tz: Timezone.TimezoneCode) => {
		setTimezone(tz)
	})

	return (
		<div className="flex h-full w-full flex-col bg-sidebar">
			{/* Header */}
			<div className="mb-3.5 w-full overflow-hidden rounded-bl-xl rounded-br-xl bg-background shadow-xs">
				<div className="flex h-12 w-full items-center gap-2 overflow-hidden px-2.5 py-0">
					<Button
						onClick={handleBack}
						variant="ghost"
						className="size-8 shrink-0 rounded-lg bg-transparent p-0"
					>
						<ChevronLeft className="size-6 text-foreground" />
					</Button>
					<div className="text-base font-medium text-foreground">
						{t("setting.timezone")}
					</div>
				</div>
			</div>

			{/* Search Box */}
			<div className="mb-3 px-3.5">
				<div className="relative">
					<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder={t("setting.searchPlaceholder")}
						className="h-9 w-full rounded-md border border-input bg-fill pl-9 pr-3 text-sm text-foreground shadow-xs"
					/>
				</div>
			</div>

			{/* Content */}
			<div className="flex w-full flex-1 flex-col overflow-y-auto bg-popover pb-safe-bottom">
				{filteredTimezoneList.length === 0 ? (
					<div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
						{t("common.notFound")}
					</div>
				) : (
					filteredTimezoneList.map((tz) => {
						const isSelected = timezone === tz.code

						return (
							<div
								key={tz.code}
								ref={isSelected ? selectedItemRef : null}
								onClick={() => handleTimezoneChange(tz.code)}
								className="flex w-full items-center justify-between gap-2 border-b border-border bg-popover px-6 py-3 transition-colors last:border-b-0 active:bg-gray-50"
							>
								<div className="text-sm text-foreground">{tz.label}</div>
								{isSelected && <Checkbox checked={true} className="size-4" />}
							</div>
						)
					})
				)}
			</div>
		</div>
	)
}

export default observer(TimezoneSelector)

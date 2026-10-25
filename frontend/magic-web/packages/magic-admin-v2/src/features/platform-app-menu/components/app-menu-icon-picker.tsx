import { ChevronsUpDown, SquareMenu } from "lucide-react"
import { DynamicIcon } from "lucide-react/dynamic"
import type { IconName } from "lucide-react/dynamic"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { FilterSearchInput } from "@magic-admin-v2/components/filter-search-input"
import { Popover, PopoverContent, PopoverTrigger } from "@magic-admin-v2/components/ui/popover"
import { appMenuIconType } from "@magic-admin-v2/features/platform-app-menu/types"
import { cn } from "@magic-admin-v2/utils/cn"

const defaultIconPickerCount = 120

type AppMenuIconInfo = {
	label: string
	tags: string[]
	value: string
}

/**
 * Keep the persisted Tabler-style values for backwards compatibility, while
 * loading their corresponding Lucide glyphs only when they are rendered.
 */
const lucideIconNames: Record<string, IconName> = {
	IconActivity: "activity",
	IconAd: "megaphone",
	IconAddressBook: "book-user",
	IconAdjustments: "sliders-horizontal",
	IconApps: "layout-grid",
	IconBell: "bell",
	IconBinaryTree2: "workflow",
	IconBook2: "book-open",
	IconBolt: "zap",
	IconBrain: "brain",
	IconBriefcase: "briefcase-business",
	IconBuildingBank: "landmark",
	IconCalendar: "calendar",
	IconCamera: "camera",
	IconChartBar: "chart-no-axes-column",
	IconClipboardList: "clipboard-list",
	IconCloud: "cloud",
	IconCode: "code-2",
	IconCpu: "cpu",
	IconCreditCard: "credit-card",
	IconCurrencyDollar: "circle-dollar-sign",
	IconDatabase: "database",
	IconDeviceDesktop: "monitor",
	IconDeviceMobile: "smartphone",
	IconFileSpreadsheet: "file-spreadsheet",
	IconFileText: "file-text",
	IconFolder: "folder-open",
	IconGauge: "gauge",
	IconHeadphones: "headphones",
	IconHeartbeat: "heart-pulse",
	IconHelpCircle: "circle-help",
	IconHome: "house",
	IconKey: "key-round",
	IconLanguage: "languages",
	IconLayersIntersect: "squares-intersect",
	IconLink: "link",
	IconLock: "lock-keyhole",
	IconMail: "mail",
	IconMapPin: "map-pin",
	IconMenu2: "menu",
	IconMessage: "message-square",
	IconMusic: "music",
	IconNetwork: "network",
	IconPackage: "package",
	IconPhone: "phone",
	IconPhoto: "image",
	IconPrinter: "printer",
	IconQrcode: "qr-code",
	IconReceipt: "receipt-text",
	IconRobot: "bot",
	IconRocket: "rocket",
	IconScan: "scan-line",
	IconSchool: "graduation-cap",
	IconSearch: "search",
	IconSend: "send",
	IconServer: "hard-drive",
	IconSettings: "settings",
	IconShieldCheck: "shield-check",
	IconShoppingCart: "shopping-cart",
	IconSparkles: "wand-sparkles",
	IconStethoscope: "stethoscope",
	IconSuperMagic: "sparkles",
	IconTerminal2: "square-terminal",
	IconTool: "wrench",
	IconUsers: "users",
	IconVideo: "file-video",
	IconWallet: "wallet-cards",
	IconWorld: "globe-2",
}

interface AppMenuIconPickerProps {
	disabled: boolean
	id?: string
	onChange: (value: string) => void
	value: string
}

interface AppMenuIconPreviewProps {
	item: {
		icon?: string
		icon_type?: number
		icon_url?: string
	}
}

const appMenuIcons: AppMenuIconInfo[] = [
	{ value: "IconSuperMagic", label: "Super Magic", tags: ["magic", "brand"] },
	{ value: "IconRobot", label: "Robot", tags: ["agent", "bot", "ai"] },
	{ value: "IconBinaryTree2", label: "Workflow", tags: ["tree", "flow"] },
	{ value: "IconTool", label: "Tool", tags: ["tool", "wrench"] },
	{ value: "IconDatabase", label: "Database", tags: ["data", "storage"] },
	{ value: "IconBook2", label: "Knowledge", tags: ["book", "library"] },
	{ value: "IconSparkles", label: "Sparkles", tags: ["model", "magic"] },
	{ value: "IconWorld", label: "World", tags: ["portal", "globe"] },
	{ value: "IconApps", label: "Apps", tags: ["apps", "grid"] },
	{ value: "IconLink", label: "Link", tags: ["link", "url"] },
	{ value: "IconHome", label: "Home", tags: ["home", "overview"] },
	{ value: "IconSettings", label: "Settings", tags: ["settings"] },
	{ value: "IconUsers", label: "Users", tags: ["members", "team"] },
	{ value: "IconShieldCheck", label: "Shield Check", tags: ["security"] },
	{ value: "IconChartBar", label: "Chart Bar", tags: ["chart", "analytics"] },
	{ value: "IconClipboardList", label: "Clipboard", tags: ["list", "task"] },
	{ value: "IconFileText", label: "File Text", tags: ["document", "file"] },
	{ value: "IconCalendar", label: "Calendar", tags: ["date", "schedule"] },
	{ value: "IconKey", label: "Key", tags: ["key", "access"] },
	{ value: "IconCode", label: "Code", tags: ["code", "develop"] },
	{ value: "IconTerminal2", label: "Terminal", tags: ["terminal", "cli"] },
	{ value: "IconCpu", label: "CPU", tags: ["compute", "hardware"] },
	{ value: "IconBrain", label: "Brain", tags: ["ai", "brain"] },
	{ value: "IconRocket", label: "Rocket", tags: ["launch", "start"] },
	{ value: "IconMessage", label: "Message", tags: ["chat", "message"] },
	{ value: "IconPackage", label: "Package", tags: ["package", "box"] },
	{ value: "IconLock", label: "Lock", tags: ["lock", "permission"] },
	{ value: "IconNetwork", label: "Network", tags: ["network"] },
	{ value: "IconHelpCircle", label: "Help Circle", tags: ["help"] },
	{ value: "IconActivity", label: "Activity", tags: ["pulse", "motion"] },
	{ value: "IconAddressBook", label: "Address Book", tags: ["contact"] },
	{ value: "IconAd", label: "Ad", tags: ["marketing"] },
	{ value: "IconAdjustments", label: "Adjustments", tags: ["controls"] },
	{ value: "IconGauge", label: "Gauge", tags: ["meter", "dashboard"] },
	{ value: "IconLayersIntersect", label: "Layers", tags: ["layers"] },
	{ value: "IconBolt", label: "Bolt", tags: ["energy", "zap"] },
	{ value: "IconMenu2", label: "Menu", tags: ["menu", "导航"] },
	{ value: "IconSearch", label: "Search", tags: ["search", "find", "搜索"] },
	{ value: "IconMail", label: "Mail", tags: ["email", "inbox", "邮件"] },
	{ value: "IconBell", label: "Notifications", tags: ["bell", "notice", "通知"] },
	{ value: "IconSend", label: "Send", tags: ["send", "submit", "发送"] },
	{ value: "IconFolder", label: "Files", tags: ["folder", "directory", "文件夹"] },
	{
		value: "IconFileSpreadsheet",
		label: "Spreadsheet",
		tags: ["sheet", "excel", "table", "表格"],
	},
	{ value: "IconVideo", label: "Video", tags: ["video", "media", "视频"] },
	{ value: "IconPhoto", label: "Gallery", tags: ["image", "photo", "gallery", "相册"] },
	{ value: "IconCamera", label: "Camera", tags: ["camera", "capture", "相机"] },
	{ value: "IconMusic", label: "Music", tags: ["music", "audio", "音乐"] },
	{ value: "IconHeadphones", label: "Audio", tags: ["headphones", "podcast", "audio", "音频"] },
	{ value: "IconMapPin", label: "Location", tags: ["map", "location", "地址", "地图"] },
	{ value: "IconPhone", label: "Phone", tags: ["phone", "call", "电话"] },
	{
		value: "IconShoppingCart",
		label: "Shopping Cart",
		tags: ["shop", "store", "commerce", "商城"],
	},
	{ value: "IconCreditCard", label: "Credit Card", tags: ["payment", "billing", "支付"] },
	{ value: "IconWallet", label: "Wallet", tags: ["wallet", "payment", "billing", "钱包"] },
	{ value: "IconReceipt", label: "Receipt", tags: ["invoice", "order", "billing", "账单"] },
	{
		value: "IconCurrencyDollar",
		label: "Finance",
		tags: ["money", "finance", "billing", "财务"],
	},
	{ value: "IconBriefcase", label: "Work", tags: ["work", "business", "办公"] },
	{
		value: "IconBuildingBank",
		label: "Organization",
		tags: ["organization", "company", "enterprise", "组织"],
	},
	{ value: "IconSchool", label: "Learning", tags: ["education", "course", "learning", "学习"] },
	{ value: "IconLanguage", label: "Language", tags: ["language", "translate", "语言"] },
	{ value: "IconHeartbeat", label: "Health", tags: ["health", "medical", "健康"] },
	{ value: "IconStethoscope", label: "Medical", tags: ["medical", "clinic", "医疗"] },
	{ value: "IconCloud", label: "Cloud", tags: ["cloud", "storage", "云"] },
	{ value: "IconServer", label: "Storage", tags: ["storage", "disk", "存储"] },
	{ value: "IconDeviceDesktop", label: "Desktop", tags: ["desktop", "computer", "桌面"] },
	{ value: "IconDeviceMobile", label: "Mobile", tags: ["mobile", "phone", "手机"] },
	{ value: "IconPrinter", label: "Print", tags: ["printer", "print", "打印"] },
	{ value: "IconQrcode", label: "QR Code", tags: ["qr", "scan", "二维码"] },
	{ value: "IconScan", label: "Scan", tags: ["scan", "scanner", "扫描"] },
]

export function AppMenuIconPicker({ disabled, id, onChange, value }: AppMenuIconPickerProps) {
	const { t } = useTranslation()
	const [isOpen, setIsOpen] = useState(false)
	const [keyword, setKeyword] = useState("")
	const scrollContainerRef = useRef<HTMLDivElement>(null)
	const iconOptions = useMemo(() => getAllAppMenuIconOptions(), [])
	const selectedIcon = getAppMenuIcon(value)
	const filteredIcons = useMemo(() => {
		const normalizedKeyword = keyword.trim().toLowerCase()
		const selectedIndex = iconOptions.findIndex((item) => item.value === value)

		if (!normalizedKeyword) {
			if (selectedIndex < defaultIconPickerCount || selectedIndex === -1) {
				return iconOptions.slice(0, defaultIconPickerCount)
			}

			const windowStart = Math.max(
				0,
				Math.min(
					selectedIndex - Math.floor(defaultIconPickerCount / 2),
					iconOptions.length - defaultIconPickerCount,
				),
			)

			return iconOptions.slice(windowStart, windowStart + defaultIconPickerCount)
		}

		return iconOptions
			.filter((item) =>
				[item.value, item.label, ...item.tags]
					.join(" ")
					.toLowerCase()
					.includes(normalizedKeyword),
			)
			.slice(0, 240)
	}, [iconOptions, keyword, value])

	useEffect(() => {
		if (!isOpen) return

		const frameId = window.requestAnimationFrame(() => {
			const selectedButton =
				scrollContainerRef.current?.querySelector<HTMLElement>('[data-selected="true"]')
			selectedButton?.scrollIntoView({ block: "center" })
		})

		return () => window.cancelAnimationFrame(frameId)
	}, [filteredIcons, isOpen])

	function handleSelect(nextValue: string) {
		onChange(nextValue)
		setIsOpen(false)
		setKeyword("")
	}

	function handleOpenChange(nextOpen: boolean) {
		setIsOpen(nextOpen)
		if (!nextOpen) setKeyword("")
	}

	return (
		<Popover open={isOpen} onOpenChange={handleOpenChange}>
			<PopoverTrigger
				data-testid="platform-app-menu-icon-picker-trigger"
				className={cn(
					"flex h-9 w-full items-center justify-between rounded-md border bg-background px-3 text-left text-sm shadow-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50",
					!selectedIcon && "text-muted-foreground",
				)}
				disabled={disabled}
				id={id}
			>
				<span className="flex min-w-0 items-center gap-2">
					{selectedIcon ? (
						<>
							<span className="flex size-6 shrink-0 items-center justify-center rounded border bg-card text-muted-foreground">
								<AppMenuIconGlyph
									value={selectedIcon.value}
									className="size-4"
									size={16}
								/>
							</span>
							<span className="truncate">{selectedIcon.label}</span>
							<span className="hidden truncate text-xs text-muted-foreground sm:inline">
								{selectedIcon.value}
							</span>
						</>
					) : (
						t("appMenu.action.selectIcon")
					)}
				</span>
				<ChevronsUpDown
					className="size-4 shrink-0 text-muted-foreground"
					aria-hidden="true"
				/>
			</PopoverTrigger>
			<PopoverContent
				data-testid="platform-app-menu-filter-content"
				align="start"
				className="w-[min(480px,calc(100vw-24px))] p-0"
			>
				<div className="border-b p-3">
					<FilterSearchInput
						autoFocus
						clearButtonTestId="platform-app-menu-search-clear-button"
						clearLabel={t("common.clear")}
						inputTestId="platform-app-menu-search-input"
						onValueChange={setKeyword}
						placeholder={t("appMenu.placeholder.searchIcon")}
						value={keyword}
					/>
				</div>
				<div ref={scrollContainerRef} className="max-h-[268px] overflow-y-auto p-2">
					{filteredIcons.length ? (
						<div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
							{filteredIcons.map((item) => (
								<button
									data-testid="platform-app-menu-icon-option"
									key={item.value}
									type="button"
									data-selected={value === item.value ? "true" : undefined}
									className={cn(
										"flex h-16 flex-col items-center justify-center gap-1 rounded-md border bg-background px-1 text-xs transition-colors hover:bg-accent",
										value === item.value &&
											"border-primary bg-accent text-accent-foreground ring-1 ring-primary",
									)}
									title={item.value}
									onClick={() => handleSelect(item.value)}
								>
									<AppMenuIconGlyph
										value={item.value}
										className="size-5"
										size={20}
									/>
									<span className="max-w-full truncate">{item.label}</span>
								</button>
							))}
						</div>
					) : (
						<div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
							{t("appMenu.empty.iconSearch")}
						</div>
					)}
				</div>
			</PopoverContent>
		</Popover>
	)
}

export function AppMenuIconPreview({ item }: AppMenuIconPreviewProps) {
	if (item.icon_type === appMenuIconType.image && item.icon_url) {
		return (
			<span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background">
				<img
					src={item.icon_url}
					alt=""
					className="size-5 object-contain"
					draggable={false}
				/>
			</span>
		)
	}

	return (
		<span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
			<AppMenuIconGlyph value={item.icon} className="size-4" size={18} />
		</span>
	)
}

function getAppMenuIcon(value?: string) {
	const matchedIcon = appMenuIcons.find((icon) => icon.value === value)
	if (matchedIcon) return matchedIcon

	if (value && getLucideIconName(value)) {
		return { value, label: value.replace(/^Icon/, ""), tags: [] }
	}

	return appMenuIcons.find((icon) => icon.value === "IconSuperMagic") ?? appMenuIcons[0]
}

function getAllAppMenuIconOptions() {
	return appMenuIcons
}

function AppMenuIconGlyph({
	className,
	size,
	value,
}: {
	className?: string
	size: number
	value?: string
}) {
	const iconName = value ? getLucideIconName(value) : null
	if (!iconName) {
		return <SquareMenu className={className} size={size} aria-hidden="true" />
	}

	return (
		<DynamicIcon
			aria-hidden="true"
			className={className}
			fallback={() => <SquareMenu className={className} size={size} aria-hidden="true" />}
			name={iconName}
			size={size}
			strokeWidth={1.75}
		/>
	)
}

function getLucideIconName(value: string) {
	return lucideIconNames[value] ?? null
}

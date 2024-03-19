import { memo } from "react"
import { Code, Monitor, Smartphone } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Tabs, TabsList, TabsTrigger } from "@/opensource/components/shadcn-ui/tabs"
import { MagicTooltip } from "@/opensource/components/base"
import { ViewModeSwitcherProps, ViewMode } from "./types"

const TRIGGER_CLASS =
	"h-full rounded-sm px-2 py-0 text-muted-foreground" +
	" data-[state=active]:bg-background data-[state=active]:text-foreground" +
	" data-[state=active]:shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]" +
	" dark:data-[state=active]:shadow-[0px_1px_3px_0px_rgba(0,0,0,0.4),0px_1px_2px_-1px_rgba(0,0,0,0.3)]"

function ViewModeSwitcher(props: ViewModeSwitcherProps) {
	const { viewMode, onViewModeChange, isMobile = false, enableMobileMode = true } = props
	const { t } = useTranslation("super")

	const handleValueChange = (value: string) => {
		onViewModeChange(value as ViewMode)
	}

	return (
		<Tabs value={viewMode} onValueChange={handleValueChange} data-testid={props["data-testid"]}>
			<TabsList className="h-6 gap-0 rounded-md bg-muted p-0.5">
				<MagicTooltip title={t("fileViewer.codeMode")} placement="top">
					<span className="inline-flex h-full items-center">
						<TabsTrigger
							value="code"
							className={TRIGGER_CLASS}
							data-testid="view-mode-code"
						>
							<Code size={16} strokeWidth={1.5} className="stroke-foreground" />
						</TabsTrigger>
					</span>
				</MagicTooltip>
				{isMobile ? (
					<MagicTooltip title={t("fileViewer.phoneMode")} placement="top">
						<span className="inline-flex h-full items-center">
							<TabsTrigger
								value="desktop"
								className={TRIGGER_CLASS}
								data-testid="view-mode-desktop"
							>
								<Smartphone
									size={16}
									strokeWidth={1.5}
									className="stroke-foreground"
								/>
							</TabsTrigger>
						</span>
					</MagicTooltip>
				) : (
					<>
						<MagicTooltip title={t("fileViewer.desktopMode")} placement="top">
							<span className="inline-flex h-full items-center">
								<TabsTrigger
									value="desktop"
									className={TRIGGER_CLASS}
									data-testid="view-mode-desktop"
								>
									<Monitor
										size={16}
										strokeWidth={1.5}
										className="stroke-foreground"
									/>
								</TabsTrigger>
							</span>
						</MagicTooltip>
						{enableMobileMode && (
							<MagicTooltip title={t("fileViewer.phoneMode")} placement="top">
								<span className="inline-flex h-full items-center">
									<TabsTrigger
										value="phone"
										className={TRIGGER_CLASS}
										data-testid="view-mode-phone"
									>
										<Smartphone
											size={16}
											strokeWidth={1.5}
											className="stroke-foreground"
										/>
									</TabsTrigger>
								</span>
							</MagicTooltip>
						)}
					</>
				)}
			</TabsList>
		</Tabs>
	)
}

export default memo(ViewModeSwitcher)

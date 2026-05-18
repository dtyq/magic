import { memo, lazy, Suspense } from "react"
import { useOrganizationSwitchPanelStyles } from "./styles.panel"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import GlobalSidebarStore from "@/stores/display/GlobalSidebarStore"
import MagicIcon from "@/components/base/MagicIcon"
import { IconPlus } from "@tabler/icons-react"
import MagicButton from "@/components/base/MagicButton"
import { functionHub } from "@/services/common/FunctionHub"
import { DefaultFunction } from "@/services/common/FunctionHub/registerDefault"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import { SquareUserRound } from "lucide-react"
import useCancelRecord from "@/components/business/RecordingSummary/hooks/useCancelRecord"

const OrganizationSwitch = lazy(() => import("./OrganizationSwitch"))

const OrganizationSwitchPanelComponent = () => {
	const { isOrganizationSwitchOpen } = GlobalSidebarStore
	const { styles } = useOrganizationSwitchPanelStyles()
	const { t } = useTranslation("interface")
	const { t: tSuper } = useTranslation("super")

	const { cancelRecord } = useCancelRecord({
		noNeedButtonText: tSuper("recordingSummary.cancelModal.noNeedWithContinue"),
		summarizeButtonText: tSuper("recordingSummary.cancelModal.summarizeWithContinue"),
		modalContent: tSuper("recordingSummary.cancelModal.messageWithContinue"),
		aiRecordingModalContent: tSuper("recordingSummary.aiRecordingModal.switchContent"),
		aiRecordingConfirmText: tSuper("recordingSummary.aiRecordingModal.switchConfirmText"),
	})

	const onSwitchBefore = useMemoizedFn(() => {
		// 组织切换可能从移动端设置 Sheet 上层打开，切换前只收起当前切换面板，避免把底层设置一起关闭。
		GlobalSidebarStore.closeOrganizationSwitch()
	})

	const handleAddAccount = useMemoizedFn(async () => {
		await cancelRecord()
		GlobalSidebarStore.closeOrganizationSwitch()
		GlobalSidebarStore.close()
		functionHub.execute(DefaultFunction.openAccountModal, {
			// 组织切换面板可能被临时提升层级（如从付费弹窗内打开），添加账号弹窗需要继续在其上方。
			zIndex: Math.max(1300, GlobalSidebarStore.organizationSwitchZIndex + 100),
		})
		// TODO: TODO 移除zIndex 配置，使用自动推测的值
	})

	const handleClose = useMemoizedFn(() => {
		GlobalSidebarStore.closeOrganizationSwitch()
	})

	return (
		<MagicPopup
			visible={isOrganizationSwitchOpen}
			destroyOnClose
			// 组织切换可从移动端设置 Sheet 内打开，默认高于 Sheet 的 z-[1100]，并支持业务场景临时抬升。
			zIndex={GlobalSidebarStore.organizationSwitchZIndex}
			bodyClassName={styles.panelContainer}
			onClose={handleClose}
		>
			{/* Title with Icon */}
			<div className="flex items-stretch gap-2 p-3.5">
				<div className="flex size-12 shrink-0 items-center justify-center rounded-md border border-border">
					<SquareUserRound className="size-6 text-foreground" />
				</div>
				<div className="flex flex-1 flex-col gap-0">
					<div className="text-lg font-medium text-foreground">
						{t("sider.accountManagement")}
					</div>
					<div className="text-sm text-muted-foreground">
						{t("sider.accountManagementDescription")}
					</div>
				</div>
			</div>
			<Suspense fallback={null}>
				<OrganizationSwitch
					className="flex-1"
					onSwitchBefore={onSwitchBefore}
					onClose={handleClose}
				/>
			</Suspense>
			<div className={styles.footer}>
				<MagicButton
					type="text"
					block
					icon={<MagicIcon component={IconPlus} size={20} />}
					onClick={handleAddAccount}
					style={{ gap: 4 }}
				>
					{t("sider.addAccount")}
				</MagicButton>
			</div>
		</MagicPopup>
	)
}

export const OrganizationSwitchPanel = memo(observer(OrganizationSwitchPanelComponent))

OrganizationSwitchPanel.displayName = "OrganizationSwitchPanel"

export default OrganizationSwitch

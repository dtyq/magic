import { AtSign } from "lucide-react"
import { useTranslation } from "react-i18next"
import { memo, useRef, useEffect, lazy, Suspense } from "react"
import { useBoolean, useMemoizedFn, useMount } from "ahooks"

import {
	BuiltinItemId,
	MentionItem,
	MentionPanelRef,
} from "@/opensource/components/business/MentionPanel/types"
import { TiptapMentionAttributes } from "@/opensource/components/business/MentionPanel/tiptap-plugin"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import GlobalMentionPanelStore, {
	MentionPanelStore,
} from "@/opensource/components/business/MentionPanel/store"
import { cn } from "@/opensource/lib/utils"
import { GuideTourElementId } from "../../../LazyGuideTour/GuideTourManager"

const MentionPanel = lazy(() => import("@/opensource/components/business/MentionPanel"))

function preloadMentionPanel() {
	return import("@/opensource/components/business/MentionPanel")
}

interface AtProps {
	onSelect?: (item: TiptapMentionAttributes) => void
	showText?: boolean
	iconSize?: number
	onClose?: () => void
	mentionPanelStore?: MentionPanelStore
	mobileClassName?: string
}

function At({
	onSelect,
	showText = true,
	iconSize = 20,
	onClose,
	mentionPanelStore = GlobalMentionPanelStore,
	mobileClassName,
}: AtProps) {
	const isMobile = useIsMobile()
	const { t, i18n } = useTranslation("super")
	const [visible, { toggle, setFalse }] = useBoolean()
	const ref = useRef<HTMLButtonElement>(null)
	const panelRef = useRef<MentionPanelRef>(null)

	const handleClose = useMemoizedFn(() => {
		panelRef.current?.reset()
		setFalse()
		onClose?.()
	})

	useMount(() => {
		requestIdleCallback(() => {
			preloadMentionPanel()
		})
	})

	const handleSelect = (item: MentionItem, context?: { reset?: () => void }) => {
		if (
			[
				BuiltinItemId.PERSONAL_DRIVE,
				BuiltinItemId.ENTERPRISE_DRIVE,
				BuiltinItemId.ORGANIZATION_DRIVE,
				BuiltinItemId.PROJECT_FILES,
				BuiltinItemId.MCP_EXTENSIONS,
				BuiltinItemId.AGENTS,
			].includes(item.id as BuiltinItemId)
		) {
			return
		}

		onSelect?.({
			type: item.type,
			data: item.data,
		})
		// Only close the panel if this is a final selection (when reset is provided)
		// For navigation items (folders, etc.), the panel should stay open
		if (context?.reset) {
			handleClose()
		}
	}

	// 处理点击外部关闭面板
	useEffect(() => {
		if (!visible || isMobile) return

		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Node
			// 检查点击是否在 At 组件内部
			const isClickInsideAt = ref.current && ref.current.contains(target)
			// 检查点击是否在 MentionPanel 内部
			const isClickInsidePanel = target && (target as Element).closest?.('[role="dialog"]')

			if (!isClickInsideAt && !isClickInsidePanel) {
				handleClose()
			}
		}

		// 延迟添加事件监听，避免立即触发
		const timer = setTimeout(() => {
			document.addEventListener("mousedown", handleClickOutside)
		}, 0)

		return () => {
			clearTimeout(timer)
			document.removeEventListener("mousedown", handleClickOutside)
		}
	}, [visible, handleClose, isMobile])

	return (
		<>
			<button
				type="button"
				ref={ref}
				className={cn(
					"flex w-fit shrink-0 cursor-pointer items-center justify-center gap-1 overflow-hidden rounded-md border p-1 text-[10px] font-normal leading-[14px] text-foreground transition-all",
					"hover:bg-secondary hover:text-primary active:bg-muted active:text-foreground",
					"dark:bg-sidebar dark:text-foreground dark:hover:bg-muted dark:hover:text-foreground",
					isMobile && mobileClassName,
				)}
				onClick={toggle}
				data-at-button
				data-visible={visible}
				id={GuideTourElementId.MessageEditorAtButton}
				data-testid="super-message-editor-at-button"
			>
				<AtSign size={iconSize} />
				{showText && t("messageEditor.at")}
			</button>
			{visible && (
				<Suspense fallback={null}>
					<MentionPanel
						ref={panelRef}
						visible={visible}
						language={i18n.language}
						triggerRef={ref}
						onSelect={handleSelect}
						onClose={handleClose}
						dataService={mentionPanelStore}
					/>
				</Suspense>
			)}
		</>
	)
}

export default memo(At)

import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import MagicModalDesktop, {
	type ModalFuncProps,
	type MagicModalDesktopProps,
	type FooterRenderFunction,
	type ModalVariant,
	type ModalSize,
} from "./MagicModalDesktop"
import MagicModalMobile from "./MagicModalMobile"
import type { MagicModalMobileProps } from "./MagicModalMobile"

export type MagicModalProps = MagicModalDesktopProps & MagicModalMobileProps

/**
 * MagicModal - A responsive modal component that adapts to desktop and mobile
 *
 * Features:
 * - Automatically switches between Desktop (shadcn/ui Dialog) and Mobile (MagicPopup/Drawer) implementations
 * - Supports common modal props with Tailwind CSS styling
 * - Provides static methods (confirm, info, success, error, warning) for desktop
 * - Mobile version uses bottom drawer with smooth animations
 * - Supports variant styles (default, destructive) based on Figma design
 * - Auto-responsive sizing (sm for mobile, md for desktop)
 *
 * @example
 * ```tsx
 * // Basic usage
 * <MagicModal open={open} onCancel={handleCancel} title="Title">
 *   Content
 * </MagicModal>
 *
 * // Static method with variant
 * MagicModal.confirm({
 *   title: 'Delete File',
 *   content: 'Are you sure you want to delete this file?',
 *   variant: 'destructive',
 *   showIcon: true,
 *   onOk: handleDelete
 * })
 * ```
 */
function MagicModal(props: MagicModalProps) {
	const isMobile = useIsMobile()

	if (isMobile) {
		return <MagicModalMobile {...props} />
	}

	return <MagicModalDesktop {...props} />
}

// Attach static methods from desktop version
// Note: These methods will use desktop modals even on mobile devices
// since they're typically called imperatively and the component isn't mounted yet
MagicModal.confirm = (config: ModalFuncProps) => MagicModalDesktop.confirm(config)
MagicModal.info = (config: ModalFuncProps) => MagicModalDesktop.info(config)
MagicModal.success = (config: ModalFuncProps) => MagicModalDesktop.success(config)
MagicModal.error = (config: ModalFuncProps) => MagicModalDesktop.error(config)
MagicModal.warning = (config: ModalFuncProps) => MagicModalDesktop.warning(config)

export default MagicModal
export type {
	MagicModalDesktopProps,
	MagicModalMobileProps,
	ModalFuncProps,
	FooterRenderFunction,
	ModalVariant,
	ModalSize,
}
export { MagicModal }

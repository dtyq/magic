import { Button } from "@/opensource/components/shadcn-ui/button"
import MagicModal from "@/opensource/components/base/MagicModal"
import { useTranslation } from "react-i18next"

/**
 * MagicModal.confirm 测试示例
 * 用于验证不同变体和响应式效果
 */
export function ConfirmDialogExamples() {
	const { t } = useTranslation("interface")

	const handleDefaultConfirm = () => {
		MagicModal.confirm({
			title: "普通确认",
			content: "这是一个普通的确认对话框,用于一般性的确认操作。",
			variant: "default",
			showIcon: true,
			okText: t("common.confirm"),
			cancelText: t("common.cancel"),
			onOk: () => {
				console.log("User confirmed")
			},
		})
	}

	const handleDestructiveConfirm = () => {
		MagicModal.confirm({
			title: "删除确认",
			content: "确定要删除这个文件吗?此操作无法撤销。",
			variant: "destructive",
			showIcon: true,
			okText: "删除",
			cancelText: t("common.cancel"),
			onOk: () => {
				console.log("File deleted")
			},
		})
	}

	const handleWithoutIcon = () => {
		MagicModal.confirm({
			title: "无图标确认",
			content: "这是一个没有图标的确认对话框。",
			variant: "default",
			showIcon: false,
			okText: t("common.confirm"),
			cancelText: t("common.cancel"),
			onOk: () => {
				console.log("Confirmed without icon")
			},
		})
	}

	const handleCustomIcon = () => {
		MagicModal.confirm({
			title: "自定义图标",
			content: "这个对话框使用了自定义图标。",
			variant: "default",
			icon: (
				<div className="flex size-10 items-center justify-center rounded-lg bg-blue-100">
					<span className="text-2xl">🎉</span>
				</div>
			),
			okText: t("common.confirm"),
			cancelText: t("common.cancel"),
			onOk: () => {
				console.log("Custom icon confirmed")
			},
		})
	}

	const handleForceMobileSize = () => {
		MagicModal.confirm({
			title: "强制移动端尺寸",
			content: "这个对话框强制使用移动端尺寸(320px)。",
			variant: "default",
			showIcon: true,
			size: "sm",
			okText: t("common.confirm"),
			cancelText: t("common.cancel"),
			onOk: () => {
				console.log("Mobile size confirmed")
			},
		})
	}

	const handleForceDesktopSize = () => {
		MagicModal.confirm({
			title: "强制桌面端尺寸",
			content: "这个对话框强制使用桌面端尺寸(384px)。",
			variant: "default",
			showIcon: true,
			size: "md",
			okText: t("common.confirm"),
			cancelText: t("common.cancel"),
			onOk: () => {
				console.log("Desktop size confirmed")
			},
		})
	}

	return (
		<div className="space-y-4 p-8">
			<h2 className="text-2xl font-bold">MagicModal.confirm 测试示例</h2>

			<div className="space-y-2">
				<h3 className="text-lg font-semibold">基础变体</h3>
				<div className="flex gap-2">
					<Button onClick={handleDefaultConfirm}>Default 变体</Button>
					<Button onClick={handleDestructiveConfirm} variant="destructive">
						Destructive 变体
					</Button>
				</div>
			</div>

			<div className="space-y-2">
				<h3 className="text-lg font-semibold">图标选项</h3>
				<div className="flex gap-2">
					<Button onClick={handleWithoutIcon} variant="outline">
						无图标
					</Button>
					<Button onClick={handleCustomIcon} variant="outline">
						自定义图标
					</Button>
				</div>
			</div>

			<div className="space-y-2">
				<h3 className="text-lg font-semibold">尺寸控制</h3>
				<div className="flex gap-2">
					<Button onClick={handleForceMobileSize} variant="outline">
						强制 SM 尺寸
					</Button>
					<Button onClick={handleForceDesktopSize} variant="outline">
						强制 MD 尺寸
					</Button>
				</div>
			</div>

			<div className="mt-8 rounded-lg border p-4">
				<h3 className="mb-2 font-semibold">测试说明:</h3>
				<ul className="list-disc space-y-1 pl-5 text-sm">
					<li>在不同屏幕尺寸下测试响应式效果</li>
					<li>验证 PC 端按钮右对齐,移动端按钮等宽</li>
					<li>检查图标显示和背景色</li>
					<li>确认 destructive 变体使用红色按钮</li>
					<li>测试自定义图标覆盖默认图标</li>
				</ul>
			</div>
		</div>
	)
}

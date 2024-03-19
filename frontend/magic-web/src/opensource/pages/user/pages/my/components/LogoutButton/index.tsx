import { Button } from "@/opensource/components/shadcn-ui/button"
import { LogOut } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { ActionDrawer } from "@/opensource/components/shadcn-composed/action-drawer"
import MenuButton from "../MenuButton"

interface LogoutButtonProps {
	onLogout?: () => void
}

export default function LogoutButton({ onLogout }: LogoutButtonProps) {
	const { t } = useTranslation("interface")

	const [logoutOpen, setLogoutOpen] = useState(false)

	const onChangeLogoutOpenChange = useMemoizedFn((open: boolean) => {
		setLogoutOpen(open)
	})

	const handleLogout = useMemoizedFn(() => {
		setLogoutOpen(false)
		onLogout?.()
	})

	return (
		<>
			<MenuButton
				icon={<LogOut className="size-4" />}
				label={t("common.logout")}
				iconClassName="text-destructive"
				labelClassName="text-destructive"
				showArrow={false}
				onClick={() => setLogoutOpen(true)}
			/>
			<ActionDrawer
				open={logoutOpen}
				onOpenChange={onChangeLogoutOpenChange}
				title={t("common.logout")}
				showCancel={false}
			>
				<div className="text-sm text-foreground">{t("setting.logoutConfirm")}</div>
				<div className="flex w-full flex-col gap-1.5">
					<Button className="w-full bg-destructive text-white" onClick={handleLogout}>
						{t("setting.exit")}
					</Button>
					<Button variant="outline" className="px-8" onClick={() => setLogoutOpen(false)}>
						{t("button.cancel")}
					</Button>
				</div>
			</ActionDrawer>
		</>
	)
}

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
	CircleCheckIcon,
	InfoIcon,
	TriangleAlertIcon,
	OctagonXIcon,
	Loader2Icon,
} from "lucide-react"
import type { CSSProperties } from "react"

const DefaultToaster = ({ ...props }: ToasterProps) => {
	const { theme = "system" } = useTheme()

	return (
		<Sonner
			theme={theme as ToasterProps["theme"]}
			className="toaster group"
			icons={{
				success: <CircleCheckIcon className="size-4" />,
				info: <InfoIcon className="size-4" />,
				warning: <TriangleAlertIcon className="size-4" />,
				error: <OctagonXIcon className="size-4" />,
				loading: <Loader2Icon className="size-4 animate-spin" />,
			}}
			style={
				{
					"--normal-bg": "var(--popover)",
					"--normal-text": "var(--popover-foreground)",
					"--normal-border": "var(--border)",
					"--border-radius": "var(--radius)",
				} as CSSProperties
			}
			toastOptions={{
				classNames: {
					toast: "cn-toast",
				},
			}}
			{...props}
		/>
	)
}

const Toaster = () => {
	const ToasterClassName =
		"!left-1/2 !right-auto !top-[calc(var(--safe-area-inset-top)+40px)] !-translate-x-1/2 [&_[data-sonner-toast]]:!w-auto  [&_[data-sonner-toast]]:!py-2"

	return <DefaultToaster visibleToasts={3} className={ToasterClassName} position="top-center" />
}

export { Toaster }

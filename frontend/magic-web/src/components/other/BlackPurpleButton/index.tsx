import { ButtonHTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/utils"

interface BlackPurpleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	icon?: ReactNode
}

function BlackPurpleButton({ icon, children, className, ...props }: BlackPurpleButtonProps) {
	return (
		<button
			type="button"
			className={cn(
				"flex items-center justify-center gap-1 self-stretch rounded-lg px-4 py-1.5",
				"border-none text-sm font-normal text-white",
				"bg-gradient-to-r from-[#443855] via-[#222] to-black",
				"transition-all duration-200 ease-in-out",
				"hover:from-[#4d4159] hover:via-[#2a2a2a] hover:to-[#0a0a0a] hover:opacity-90",
				"active:scale-[0.98] active:from-[#3d3248] active:via-[#1a1a1a] active:to-black active:opacity-85",
				"disabled:cursor-not-allowed disabled:opacity-50",
				"cursor-pointer",
				className,
			)}
			{...props}
		>
			{icon}
			{children}
		</button>
	)
}

export default BlackPurpleButton

import { Flex } from "antd"
import { memo } from "react"
import type { BottomActionBarProps } from "./types"
import { Button } from "@/opensource/components/shadcn-ui/button"

function BottomActionBar({
	primaryText,
	primaryIcon,
	secondaryText,
	secondaryIcon,
	onPrimaryClick,
	onSecondaryClick,
}: BottomActionBarProps) {
	return (
		<Flex
			gap={12}
			className="sticky bottom-0 h-[60px] flex-shrink-0 border-t border-border bg-background p-2.5"
		>
			{onSecondaryClick && (
				<Button className="flex h-10 border-none" onClick={onSecondaryClick}>
					{secondaryIcon}
					<span>{secondaryText}</span>
				</Button>
			)}
			{onPrimaryClick && (
				<Button
					className="mb-2 flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border text-sm font-medium leading-5 transition-all duration-200 hover:border-primary hover:bg-fill-secondary hover:text-primary active:scale-[0.98]"
					onClick={onPrimaryClick}
					variant="outline"
				>
					{primaryIcon}
					<span>{primaryText}</span>
				</Button>
			)}
		</Flex>
	)
}

export default memo(BottomActionBar)

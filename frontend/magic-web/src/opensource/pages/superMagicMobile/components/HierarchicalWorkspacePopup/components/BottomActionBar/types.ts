export interface BottomActionBarProps {
	level: "workspace" | "project" | "topic"
	primaryText?: string
	primaryIcon?: React.ReactNode
	secondaryText?: string
	secondaryIcon?: React.ReactNode
	onPrimaryClick?: () => void
	onSecondaryClick?: (e?: React.MouseEvent) => void
}

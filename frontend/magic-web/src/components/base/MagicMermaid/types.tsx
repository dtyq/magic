export interface MagicMermaidProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> {
	onClick?: (dom: HTMLDivElement | null) => Promise<void> | void
	data?: string
	allowShowCode?: boolean
	copyText?: string
}

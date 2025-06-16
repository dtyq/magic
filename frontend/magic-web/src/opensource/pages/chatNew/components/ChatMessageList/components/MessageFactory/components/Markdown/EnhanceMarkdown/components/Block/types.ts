export interface BlockRenderProps {
	language?: string
	data?: string
}

export type Block = string | { component: React.ComponentType<any>; props: BlockRenderProps }

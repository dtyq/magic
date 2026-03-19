import KeyManagerButton from "@/pages/flow/components/KeyManager/KeyManagerButton"
import { Button, Flex } from "antd"
import { useBoolean } from "ahooks"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import { createStyles, cx } from "antd-style"
import type { Knowledge } from "@/types/knowledge"

const useStyles = createStyles(({ css }) => {
	return {
		form: css`
			:global {
				.magic-form-item {
					margin-bottom: 10px;
				}
			}
		`,
		btn: css`
			color: #1c1d23cc;
			border-color: #1c1d2314;
			font-weight: 400;
		`,
	}
})

type UseApiKeyProps = {
	Icon?: boolean
	flow: MagicFlow.Flow | Knowledge.Detail
	isAgent: boolean
	className?: string
}

export default function ApiKeyButton({ flow, Icon, isAgent, className }: UseApiKeyProps) {
	const [keyManagerOpen, { setTrue: openKeyManager, setFalse: closeKeyManager }] =
		useBoolean(false)

	const { styles } = useStyles()

	return (
		<>
			{!Icon && (
				<Button type="text" onClick={openKeyManager} className={cx(styles.btn, className)}>
					API Key
				</Button>
			)}
			{Icon && (
				<Flex flex={1} onClick={openKeyManager}>
					API Key
				</Flex>
			)}
			<KeyManagerButton
				open={keyManagerOpen}
				onClose={closeKeyManager}
				flowId={flow?.id || ""}
				isAgent={isAgent}
			/>
		</>
	)
}

import { CopyableValue } from "@magic-admin-v2/components/copyable-value"

export function CopyableCode({ value }: { value: string }) {
	return <CopyableValue className="max-w-full" value={value} />
}

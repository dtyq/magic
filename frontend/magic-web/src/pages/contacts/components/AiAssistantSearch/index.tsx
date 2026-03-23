import { Search } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { ChangeEvent } from "react"
import { Input } from "@/components/shadcn-ui/input"

interface AiAssistantSearchProps {
	value: string
	onChange: (event: ChangeEvent<HTMLInputElement>) => void
}

export function AiAssistantSearch(props: AiAssistantSearchProps) {
	const { value, onChange } = props
	const { t } = useTranslation("interface")

	return (
		<div className="relative" data-testid="contacts-ai-assistant-search">
			<Search
				size={16}
				className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
			/>
			<Input
				value={value}
				onChange={onChange}
				placeholder={t("search")}
				className="h-10 rounded-lg bg-background pl-9"
				data-testid="contacts-ai-assistant-search-input"
			/>
		</div>
	)
}

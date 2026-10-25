import { getInspectorElementDisplayText } from "@/components/business/ElementInspector/format"

export function getInspectorDetailHeaderLabel(
	t: (key: string) => string,
	textContent?: string,
	tagName?: string,
	accessibleName?: string,
): string {
	if (!tagName) {
		const normalizedText = textContent?.replace(/\s+/g, " ").trim()
		return normalizedText || t("stylePanel.inspector.selectedElement")
	}

	const label = getInspectorElementDisplayText(
		{ tagName, textContent: textContent ?? "", accessibleName },
		t,
	)
	return label || t("stylePanel.inspector.selectedElement")
}

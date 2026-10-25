import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { usePersonaResearchStore } from "../../context"
import {
	createPersonaId,
	detectPersonalIdentifiers,
	emptyPersonaForm,
	formToPersona,
	missingRequiredFields,
	personaToForm,
	type PersonaFormField,
	type PersonaFormValues,
} from "../../services/personaRules"
import { createPersonaFile, updatePersonaFile } from "../../services/personaWriter"
import type { PersonaFile, ResearchFileRef } from "../../types"

export type PersonaFormSectionKey = "basic" | "needs" | "mind" | "voice"

/** Which form fields live in which collapsible section; used for "N missing" and auto-expand. */
export const SECTION_FIELDS: Record<PersonaFormSectionKey, PersonaFormField[]> = {
	basic: [
		"name",
		"tagline",
		"age",
		"gender",
		"occupation",
		"cityTier",
		"region",
		"income",
		"tags",
	],
	needs: ["pains", "story", "purchaseChannel", "device", "techAdoption"],
	mind: ["values", "riskAttitude", "social"],
	voice: ["expression", "decisionWeights", "actions", "consistencyNotes"],
}

const DEFAULT_OPEN: Record<PersonaFormSectionKey, boolean> = {
	basic: true,
	needs: true,
	mind: false,
	voice: false,
}

export type PersonaSaveResult =
	| { kind: "saved"; personaId: string }
	| { kind: "invalid" }
	| { kind: "identifiers" }
	| { kind: "conflict" }
	| { kind: "failed" }

/**
 * State and save flow of the manual persona form (create and edit).
 *
 * Save order: required fields → personal-identifier hint (once; "save anyway" skips it) →
 * write. On a conflict the latest file becomes the new edit baseline while the user's input
 * stays in the form, so the next save compares against what is on the server now.
 */
export function usePersonaForm({
	open,
	editing,
}: {
	open: boolean
	editing: ResearchFileRef<PersonaFile> | null
}) {
	const store = usePersonaResearchStore()
	const [values, setValues] = useState<PersonaFormValues>(emptyPersonaForm)
	const [sections, setSections] = useState(DEFAULT_OPEN)
	const [submitted, setSubmitted] = useState(false)
	const [identifierKinds, setIdentifierKinds] = useState<string[]>([])
	const [saving, setSaving] = useState(false)
	const baseRef = useRef<ResearchFileRef<PersonaFile> | null>(null)

	// Reset each time the dialog opens, from the persona being edited or an empty form.
	useEffect(() => {
		if (!open) return
		baseRef.current = editing
		setValues(editing ? personaToForm(editing.data) : emptyPersonaForm())
		setSections(editing ? { basic: true, needs: true, mind: true, voice: true } : DEFAULT_OPEN)
		setSubmitted(false)
		setIdentifierKinds([])
	}, [open, editing])

	const missing = submitted ? missingRequiredFields(values) : []

	const setField = useMemoizedFn(
		<K extends PersonaFormField>(field: K, value: PersonaFormValues[K]) => {
			setValues((current) => ({ ...current, [field]: value }))
			// Editing the text dismisses an identifier hint the user is now acting on.
			setIdentifierKinds([])
		},
	)

	const toggleSection = useMemoizedFn((key: PersonaFormSectionKey) => {
		setSections((current) => ({ ...current, [key]: !current[key] }))
	})

	const save = useMemoizedFn(async (allowIdentifiers = false): Promise<PersonaSaveResult> => {
		setSubmitted(true)
		const required = missingRequiredFields(values)
		if (required.length > 0) {
			setSections((current) => {
				const next = { ...current }
				for (const key of Object.keys(SECTION_FIELDS) as PersonaFormSectionKey[]) {
					if (SECTION_FIELDS[key].some((field) => required.includes(field)))
						next[key] = true
				}
				return next
			})
			return { kind: "invalid" }
		}
		if (!allowIdentifiers) {
			const texts = Object.values(values).flatMap((value) =>
				Array.isArray(value)
					? value.map((item) => (typeof item === "string" ? item : item.factor))
					: [value],
			)
			const kinds = detectPersonalIdentifiers(texts)
			if (kinds.length > 0) {
				setIdentifierKinds(kinds)
				return { kind: "identifiers" }
			}
		}

		setSaving(true)
		try {
			const base = baseRef.current
			if (!base) {
				const existing = new Set(store.personas.map((ref) => ref.data.id))
				const persona = formToPersona(values, {
					id: createPersonaId(values.name, existing),
				})
				const outcome = await createPersonaFile(store, persona)
				return outcome === "saved"
					? { kind: "saved", personaId: persona.id }
					: { kind: "failed" }
			}
			const persona = formToPersona(values, { id: base.data.id, base: base.data })
			const outcome = await updatePersonaFile(store, base, persona)
			if (outcome === "conflict") {
				await store.refreshAttachments().catch(() => undefined)
				baseRef.current = store.personaRefById(base.data.id) ?? base
				return { kind: "conflict" }
			}
			return outcome === "saved"
				? { kind: "saved", personaId: persona.id }
				: { kind: "failed" }
		} catch {
			return { kind: "failed" }
		} finally {
			setSaving(false)
		}
	})

	return {
		values,
		setField,
		sections,
		toggleSection,
		missing,
		identifierKinds,
		saving,
		save,
	}
}

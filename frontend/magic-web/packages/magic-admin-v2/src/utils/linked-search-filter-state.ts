export function createLinkedAdvancedFilterDraft<
  TDraft extends object,
  TField extends keyof TDraft,
>(draft: TDraft, field: TField, searchValue: string): TDraft {
  if (!searchValue.trim()) return draft;

  return {
    ...draft,
    [field]: searchValue,
  };
}

export function createLinkedAppliedFilterDraft<
  TDraft extends object,
  TField extends keyof TDraft,
  TSearchValueField extends keyof TDraft,
>(draft: TDraft, field: TField, searchValueField: TSearchValueField): TDraft {
  const fieldValue = draft[field];

  return {
    ...draft,
    [searchValueField]: typeof fieldValue === "string" ? fieldValue : "",
    [field]: "",
  } as TDraft;
}

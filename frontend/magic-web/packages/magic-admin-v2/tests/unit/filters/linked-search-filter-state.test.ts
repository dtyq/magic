import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createLinkedAdvancedFilterDraft,
  createLinkedAppliedFilterDraft,
} from "../../../src/utils/linked-search-filter-state.ts";

describe("linked quick and advanced search state", () => {
  it("fills the active quick-search value into its advanced field", () => {
    const draft = {
      searchField: "organizationCode" as const,
      searchValue: "org-1",
      organizationCode: "",
      userName: "Alice",
    };

    assert.deepEqual(
      createLinkedAdvancedFilterDraft(draft, draft.searchField, draft.searchValue),
      {
        ...draft,
        organizationCode: "org-1",
      },
    );
  });

  it("syncs the active advanced field back and clears the duplicate value", () => {
    const draft = {
      searchField: "organizationCode" as const,
      searchValue: "org-old",
      organizationCode: "org-new",
      userName: "Alice",
    };

    assert.deepEqual(
      createLinkedAppliedFilterDraft(draft, draft.searchField, "searchValue"),
      {
        ...draft,
        searchValue: "org-new",
        organizationCode: "",
      },
    );
  });

  it("does not manufacture an advanced value for an empty quick search", () => {
    const draft = {
      searchField: "userName" as const,
      searchValue: "   ",
      organizationCode: "org-1",
      userName: "Alice",
    };

    assert.equal(
      createLinkedAdvancedFilterDraft(draft, draft.searchField, draft.searchValue),
      draft,
    );
  });
});

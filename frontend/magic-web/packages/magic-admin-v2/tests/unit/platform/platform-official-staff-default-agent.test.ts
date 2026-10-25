import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  buildDefaultAgentOptions,
  getOfficialStaffDisplayName,
} from "../../../src/features/platform-official-staff/utils/default-agent";
import type { OfficialStaff } from "../../../src/features/platform-official-staff/types";

function createStaff(overrides: Partial<OfficialStaff> = {}): OfficialStaff {
  return {
    distribution_type: 1,
    id: overrides.id ?? "staff-id",
    identifier: overrides.identifier ?? "general",
    name_i18n: overrides.name_i18n ?? { zh_CN: "通用员工", en_US: "General" },
    status: overrides.status ?? true,
    ...overrides,
  };
}

describe("official staff default agent options", () => {
  it("keeps only enabled non-system staff as selectable options", () => {
    const options = buildDefaultAgentOptions([
      createStaff({ identifier: "general" }),
      createStaff({ identifier: "disabled", status: false }),
      createStaff({ identifier: "system", is_default: 1 }),
    ]);

    assert.deepEqual(options.map((option) => option.value), ["general"]);
  });

  it("does not render an option with an empty identifier", () => {
    const options = buildDefaultAgentOptions([
      createStaff({ identifier: "" }),
      createStaff({ identifier: "general" }),
    ]);

    assert.deepEqual(options.map((option) => option.value), ["general"]);
  });

  it("preserves an unavailable current value as disabled", () => {
    const options = buildDefaultAgentOptions(
      [createStaff({ identifier: "general" })],
      "removed-agent",
    );

    assert.deepEqual(options[0], {
      disabled: true,
      label: "removed-agent",
      value: "removed-agent",
    });
  });

  it("uses the active language before the fallback languages", () => {
    const staff = createStaff({
      name_i18n: { en_US: "General", zh_CN: "通用员工" },
    });

    assert.equal(getOfficialStaffDisplayName(staff, "en_US"), "General");
    assert.equal(getOfficialStaffDisplayName(staff, "zh_CN"), "通用员工");
  });
});

describe("official staff icon editing", () => {
  const groupSource = readFileSync(
    "src/features/platform-official-staff/components/assignment/model-group-card.tsx",
    "utf8",
  );
  const assignmentDialogSource = readFileSync(
    "src/features/platform-official-staff/components/assignment/assignment-dialogs.tsx",
    "utf8",
  );
  const uploadSource = readFileSync(
    "src/features/platform-official-staff/components/staff-icon-upload-field.tsx",
    "utf8",
  );
  const sharedUploadSource = readFileSync(
    "src/components/image-upload/avatar-image-upload-field.tsx",
    "utf8",
  );

  it("uses backend group and dynamic model icon values directly", () => {
    assert.equal(groupSource.includes("src={entry.group.icon}"), true);
    assert.equal(assignmentDialogSource.includes("model_icon: values.modelIcon.trim()"), true);
    assert.equal(assignmentDialogSource.includes("icon: groupIcon.trim()"), true);
  });

  it("only shows a preview when an icon exists and otherwise renders upload", () => {
    assert.equal(uploadSource.includes('layout="conditional"'), true);
    assert.equal(uploadSource.includes("showPreviewWhenEmpty={false}"), true);
    assert.equal(sharedUploadSource.includes('layout === "conditional"'), true);
    assert.equal(sharedUploadSource.includes('t("common.replace")'), true);
    assert.equal(sharedUploadSource.includes('t("common.upload")'), true);
  });
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const pageSource = readFileSync(
  "src/features/platform-official-staff/platform-official-staff-page.tsx",
  "utf8",
);
const staffListSource = readFileSync(
  "src/features/platform-official-staff/components/staff/staff-list.tsx",
  "utf8",
);
const staffFormSource = readFileSync(
  "src/features/platform-official-staff/components/staff/official-staff-form-dialog.tsx",
  "utf8",
);
const assignmentSource = readFileSync(
  "src/features/platform-official-staff/components/assignment/assign-models-dialog.tsx",
  "utf8",
);
const assignmentActionsSource = readFileSync(
  "src/features/platform-official-staff/hooks/use-assignment-actions.ts",
  "utf8",
);
const assignmentDialogsSource = readFileSync(
  "src/features/platform-official-staff/components/assignment/assignment-dialogs.tsx",
  "utf8",
);
const modelGroupSource = readFileSync(
  "src/features/platform-official-staff/components/assignment/model-group-card.tsx",
  "utf8",
);
const staffFeatureSource = [
  pageSource,
  staffListSource,
  staffFormSource,
  assignmentSource,
  assignmentActionsSource,
  assignmentDialogsSource,
  modelGroupSource,
].join("\n");
const deleteConfirmSource = readFileSync("src/components/delete-confirm-dialog.tsx", "utf8");

describe("platform official staff write permissions", () => {
  it("uses the official staff edit permission as the page write boundary", () => {
    assert.equal(
      pageSource.includes(
        "const hasEditRight = useRights(PERMISSION_KEY_MAP.MODE_MANAGEMENT_EDIT)",
      ),
      true,
    );
    assert.equal(pageSource.includes("canEdit={hasEditRight}"), true);
    assert.equal(staffFeatureSource.includes("disabled={!canEdit || isDefault}"), true);
    assert.match(
      staffFeatureSource,
      /const handleStatusChange = async \(\) => \{\s*if \(!hasEditRight \|\| !statusDialog\) return;?/,
    );
  });

  it("hides employee create and edit actions from query-only users", () => {
    assert.match(
      staffFeatureSource,
      /\{hasEditRight \? \(\s*<(?:Button|PageHeaderActionButton)[^>]*onClick=\{\(\) => setStaffDialog\(\{ open: true, staff: null \}\)\}/,
    );
    assert.match(
      staffFeatureSource,
      /\{canEdit \? \(\s*<(?:Button|DropdownMenu)[^>]*?(?:onClick|onSelect)=\{\(\) => onEdit\(item\)\}/,
    );
    assert.match(
      staffFeatureSource,
      /const handleSubmit = form\.handleSubmit\(async \(values\) => \{\s*if \(!canEdit\) return;?/,
    );
  });

  it("keeps model assignment readable while disabling every write path", () => {
    assert.equal(
      staffFeatureSource.includes("const editable = canEdit && Boolean(detail) && !isFollow;"),
      true,
    );
    assert.match(
      staffFeatureSource,
      /const handleDistributionChange = async \(value: string\) => \{[\s\S]*?if \(!canEdit \|\| !detail\) return;/,
    );
    assert.match(
      staffFeatureSource,
      /const handleFollowModeChange = async \(id: string\) => \{[\s\S]*?if \(!canEdit \|\| !detail\) return;/,
    );
    assert.match(
      staffFeatureSource,
      /const handleSave = async \(\) => \{\s*if \(!canEdit \|\| !staff \|\| !detail\) return;/,
    );
    assert.match(
      staffFeatureSource,
      /<Button(?=[^>]*disabled=\{!canEdit \|\| !detail \|\| saveConfigPending\})(?=[^>]*onClick=\{handleSave\})[^>]*>/u,
    );
  });

  it("guards group and dynamic-model mutations inside their handlers", () => {
    assert.match(
      staffFeatureSource,
      /const requestDeleteGroup = \(\) => \{\s*if \(!editable\) return;/,
    );
    assert.match(
      staffFeatureSource,
      /function GroupFormDialog[\s\S]*?const handleSave = async \([^)]*\) => \{\s*if \(!canEdit \|\| !detail(?: \|\| isIconUploading)?\) return;?/,
    );
    assert.match(
      staffFeatureSource,
      /function DynamicModelEditDialog[\s\S]*?const handleSave = \([^)]*\) => \{\s*if \(!canEdit(?: \|\| isIconUploading)?\) return;?/,
    );
  });

  it("looks up an employee only after input changes or an explicit fetch", () => {
    assert.equal(staffFeatureSource.includes("useDebounceFn("), true);
    assert.equal(staffFeatureSource.includes("scheduleAgentLookup(event.target.value)"), true);
    assert.equal(staffFeatureSource.includes("onClick={handleAgentLookup}"), true);
    assert.equal(staffFeatureSource.includes("onBlur={() =>"), false);
    assert.match(
      staffFeatureSource,
      /const handleOpenChange = \(nextOpen: boolean\) => \{[\s\S]*?cancelAgentLookup\(\);?[\s\S]*?setLookupCode\(null\);?/,
    );
    assert.match(
      staffFeatureSource,
      /form\.getValues\("identifier"\)\.trim\(\) !== lookupCode/,
    );
  });

  it("requires one centralized confirmation before reset and every delete action", () => {
    assert.equal(staffFeatureSource.match(/<DeleteConfirmDialog/g)?.length, 1);
    assert.equal(
      staffFeatureSource.includes('onClick={() => setConfirmAction({ kind: "reset" })}'),
      true,
    );
    assert.equal(staffFeatureSource.includes("onSelect={requestDeleteGroup}"), true);
    assert.equal(staffFeatureSource.includes("onDelete={requestDeleteModel}"), true);
    assert.equal(staffFeatureSource.includes("onDeleteSubModel={requestDeleteSubModel}"), true);
    assert.match(
      staffFeatureSource,
      /const handleConfirmAction = async \(\) => \{\s*if \(!canEdit \|\| !detail \|\| !confirmAction\) return;/,
    );
    assert.match(
      staffFeatureSource,
      /if \(confirmAction\.kind === "group"\)[\s\S]*?deleteGroupMutation\.mutateAsync\(confirmAction\.groupId\)/,
    );
  });

  it("lets destructive non-delete actions replace the shared dialog icon", () => {
    assert.equal(deleteConfirmSource.includes("confirmIcon?: ReactNode;"), true);
    assert.equal(
      deleteConfirmSource.includes(
        'confirmIcon ?? <Trash2 className="size-4" aria-hidden="true" />',
      ),
      true,
    );
    assert.equal(
      staffFeatureSource.includes('<RotateCcw className="size-4" aria-hidden="true" />'),
      true,
    );
  });
});

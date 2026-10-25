import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createPlatformOfficialStaffApi } from "../../../src/features/platform-official-staff/api";
import {
  addModelToDetail,
  createDynamicModel,
  normalizeDetailForSave,
  normalizeDetailFromResponse,
} from "../../../src/features/platform-official-staff/utils/assignment-models";
import type {
  OfficialStaff,
  OfficialStaffDetail,
  OfficialStaffGroup,
  StaffBaseModel,
} from "../../../src/features/platform-official-staff/types";
import type { HttpClient } from "../../../src/api/types";

function createMode(): OfficialStaff {
  return {
    distribution_type: 1,
    id: "mode-1",
    identifier: "general",
    name_i18n: { zh_CN: "通用员工", en_US: "General" },
    status: true,
  };
}

function createGroup(): OfficialStaffGroup {
  return {
    id: "group-1",
    mode_id: "mode-1",
    name_i18n: { zh_CN: "模型分组", en_US: "Model group" },
  };
}

function createModel(modelId: string, category: string, sort = 99): StaffBaseModel {
  return {
    group_id: "group-1",
    id: `model-${modelId}`,
    model_category: category,
    model_id: modelId,
    model_name: modelId,
    model_status: "normal",
    sort,
  };
}

function createDetail(): OfficialStaffDetail {
  return {
    mode: createMode(),
    groups: [
      {
        group: createGroup(),
        text_models: [createModel("text-2", "llm")],
        image_models: [createModel("image-1", "vlm")],
        video_models: [createModel("video-1", "vgm")],
      },
    ],
  };
}

describe("official staff three-category model configuration", () => {
  it("adds a dynamic model to the target group", () => {
    const result = addModelToDetail(
      createDetail(),
      { id: "dynamic", model_id: "dynamic" },
      { groupId: "group-1" },
      "text",
    );

    assert.equal(result.status, "success");
    if (result.status !== "success") return;
    assert.equal(result.detail.groups[0].text_models.length, 2);
    assert.equal("model_type" in result.detail.groups[0].text_models[1], true);
  });

  it("blocks a duplicate model in the same group", () => {
    const result = addModelToDetail(
      createDetail(),
      { category: "llm", id: "text-2", model_id: "text-2" },
      { groupId: "group-1" },
      "text",
    );

    assert.deepEqual(result, { error: "modelExistsInGroup", status: "blocked" });
  });

  it("blocks nesting a dynamic model inside another dynamic model", () => {
    const detail = createDetail();
    detail.groups[0].text_models.push(createDynamicModel("group-1", 1));
    const dynamicModel = detail.groups[0].text_models[1];
    const result = addModelToDetail(
      detail,
      { id: "dynamic", model_id: "dynamic" },
      { dynamicId: dynamicModel.id, groupId: "group-1" },
      "text",
    );

    assert.deepEqual(result, { error: "dynamicNested", status: "blocked" });
  });

  it("normalizes and preserves each category independently", () => {
    const normalized = normalizeDetailForSave(createDetail());
    const group = normalized.groups[0];

    assert.deepEqual(group.text_models.map((model) => model.model_id), ["text-2"]);
    assert.deepEqual(group.image_models.map((model) => model.model_id), ["image-1"]);
    assert.deepEqual(group.video_models.map((model) => model.model_id), ["video-1"]);
    assert.equal(group.text_models[0].sort, 0);
    assert.equal(group.image_models[0].sort, 0);
    assert.equal(group.video_models[0].sort, 0);
    assert.equal("models" in group, false);
  });

  it("treats backend category arrays as authoritative over the mixed compatibility field", () => {
    const textModelWithUnknownCategory = createModel("text-from-backend", "", 2);
    const detail = {
      ...createDetail(),
      groups: [
        {
          ...createDetail().groups[0],
          models: [
            createModel("mixed-text", "llm"),
            createModel("mixed-video", "vgm"),
          ],
          text_models: [textModelWithUnknownCategory],
          image_models: [],
          video_models: [createModel("video-from-backend", "vgm")],
        },
      ],
    } satisfies OfficialStaffDetail;

    const normalized = normalizeDetailFromResponse(detail);
    assert.deepEqual(normalized.groups[0].text_models.map((model) => model.model_id), ["text-from-backend"]);
    assert.deepEqual(normalized.groups[0].image_models, []);
    assert.deepEqual(normalized.groups[0].video_models.map((model) => model.model_id), ["video-from-backend"]);
  });

  it("submits only the three category fields and never the mixed models field", async () => {
    let requestBody: unknown;
    const client = {
      put: async (_url: string, body: unknown) => {
        requestBody = body;
        return null;
      },
    } as unknown as HttpClient;

    const api = createPlatformOfficialStaffApi(client);
    await api.saveOfficialStaffConfig("mode-1", {
      ...createDetail(),
      groups: [
        {
          ...createDetail().groups[0],
          models: [createModel("legacy-mixed", "llm")],
        },
      ],
    });

    const body = requestBody as { groups: Array<Record<string, unknown>> };
    assert.deepEqual(Object.keys(body.groups[0]).sort(), ["group", "image_models", "text_models", "video_models"]);
    assert.deepEqual(
      (body.groups[0].text_models as StaffBaseModel[]).map((model) => model.model_id),
      ["text-2"],
    );
    assert.equal("models" in body.groups[0], false);
  });
});

describe("official staff assignment draft lifecycle", () => {
  const assignmentDialogSource = readFileSync(
    "src/features/platform-official-staff/components/assignment/assign-models-dialog.tsx",
    "utf8",
  );

  it("does not replace an initialized draft when detail data refreshes", () => {
    assert.equal(
      assignmentDialogSource.includes(
        "setDetail((current) => current ?? detailQuery.data);",
      ),
      true,
    );
  });

  it("clears the draft when the dialog or selected staff changes", () => {
    assert.equal(
      assignmentDialogSource.includes(
        "}, [open, staff?.id]);",
      ),
      true,
    );
  });
});

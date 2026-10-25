import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createPlatformOfficialMarketplaceApi } from "../../../src/features/platform-official-marketplace/api.ts";
import { buildAgentMarketCategorySaveParams } from "../../../src/features/platform-official-marketplace/utils.ts";
import { agentMarketCategoryStatus } from "../../../src/features/platform-official-marketplace/types.ts";

const managerSource = readFileSync(
  "src/features/platform-official-marketplace/components/agent-market-category-manager-dialog.tsx",
  "utf8",
);
const formSource = readFileSync(
  "src/features/platform-official-marketplace/components/agent-market-category-form-dialog.tsx",
  "utf8",
);
const categoryMessagesZh = JSON.parse(
  readFileSync("src/i18n/messages/base/zh_CN/officialMarketplace.json", "utf8"),
) as Record<string, string>;
const pageSource = [
  "src/features/platform-official-marketplace/platform-official-marketplace-page.tsx",
  "src/features/platform-official-marketplace/components/employee-market-panel.tsx",
  "src/features/platform-official-marketplace/components/agent-market-category-manager-dialog.tsx",
]
  .map((filePath) => readFileSync(filePath, "utf8"))
  .join("\n");
const permissionSource = readFileSync(
  "src/features/platform-official-marketplace/utils.ts",
  "utf8",
);
const mutationSource = readFileSync(
  "src/features/platform-official-marketplace/mutations.ts",
  "utf8",
);
const querySource = readFileSync(
  "src/features/platform-official-marketplace/queries.ts",
  "utf8",
);

describe("official marketplace employee category management", () => {
  it("keeps the legacy category CRUD endpoint contract", async () => {
    const calls: Array<{ data?: unknown; method: string; url: string }> = [];
    const client = {
      delete: async <T, D>(url: string, data?: D) => {
        calls.push({ data, method: "delete", url });
        return null as T;
      },
      get: async <T>(url: string) => {
        calls.push({ method: "get", url });
        return null as T;
      },
      patch: async <T>() => null as T,
      post: async <T, D>(url: string, data?: D) => {
        calls.push({ data, method: "post", url });
        return null as T;
      },
      put: async <T, D>(url: string, data?: D) => {
        calls.push({ data, method: "put", url });
        return null as T;
      },
    };
    const api = createPlatformOfficialMarketplaceApi(client);
    const values = {
      name_i18n: { en_US: "Productivity", zh_CN: "效率工具" },
      sort_order: 10,
      status: agentMarketCategoryStatus.visible,
    };

    await api.getAgentMarketCategoryDetail("category-id");
    await api.createAgentMarketCategory(values);
    await api.updateAgentMarketCategory("category-id", values);
    await api.deleteAgentMarketCategory("category-id");

    assert.deepEqual(calls, [
      {
        method: "get",
        url: "/api/v2/admin/super-magic/agents/categories/category-id",
      },
      {
        data: values,
        method: "post",
        url: "/api/v2/admin/super-magic/agents/categories",
      },
      {
        data: values,
        method: "put",
        url: "/api/v2/admin/super-magic/agents/categories/category-id",
      },
      {
        data: undefined,
        method: "delete",
        url: "/api/v2/admin/super-magic/agents/categories/category-id",
      },
    ]);
  });

  it("normalizes the localized category form payload", () => {
    assert.deepEqual(
      buildAgentMarketCategorySaveParams({
        nameEn: "  Productivity  ",
        nameZh: "  效率工具  ",
        sortOrder: -3.8,
        visible: false,
      }),
      {
        name_i18n: { en_US: "Productivity", zh_CN: "效率工具" },
        sort_order: 0,
        status: agentMarketCategoryStatus.hidden,
      },
    );
  });

  it("provides the complete legacy management surface and permission guard", () => {
    assert.equal(pageSource.includes("AgentMarketCategoryManagerDialog"), true);
    assert.equal(permissionSource.includes("PLATFORM_EMPLOYEE_MARKET_EDIT"), true);
    assert.equal(pageSource.includes("disabled={!canEdit"), true);
    assert.equal(managerSource.includes("DeleteConfirmDialog"), true);
    assert.equal(managerSource.includes("useAgentMarketCategoryMutations"), true);
    assert.equal(managerSource.includes("updateStatus"), true);
    assert.equal(managerSource.includes("updateSortOrder"), true);
    assert.equal(managerSource.includes("toCategoryListParams"), true);
    assert.equal(formSource.includes("nameZh"), true);
    assert.equal(formSource.includes("nameEn"), true);
    assert.equal(formSource.includes("sortOrder"), true);
    assert.equal(formSource.includes("visible"), true);
  });

  it("keeps manager filters isolated while invalidating all category consumers", () => {
    assert.equal(querySource.includes("employeeCategories: (params?"), true);
    assert.equal(querySource.includes("employeeCategoryLists"), true);
    assert.equal(mutationSource.includes("employeeCategoryLists()"), true);
    assert.equal(mutationSource.includes("employeeLists()"), true);
  });

  it("places display status below sorting with the updated label", () => {
    const sortFieldIndex = formSource.indexOf(
      't("officialMarketplace.category.form.sortOrder")',
    );
    const displayStatusIndex = formSource.indexOf(
      't("officialMarketplace.category.form.visible")',
    );

    assert.equal(categoryMessagesZh["category.form.visible"], "显示状态");
    assert.equal(sortFieldIndex >= 0, true);
    assert.equal(displayStatusIndex > sortFieldIndex, true);
    assert.equal(formSource.includes("sm:grid-cols-2"), false);
    assert.equal(formSource.includes("sm:mt-[1.625rem]"), false);
    assert.equal(
      /<DialogFormField[\s\S]*label=\{t\("officialMarketplace\.category\.form\.visible"\)\}[\s\S]*<Switch/.test(
        formSource,
      ),
      true,
    );
  });
});

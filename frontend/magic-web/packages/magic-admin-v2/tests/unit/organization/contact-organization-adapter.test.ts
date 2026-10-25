import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createContactOrganizationSelectorAdapters } from "../../../src/components/organization-selectors/contact-organization.ts";

describe("contact organization selector adapter", () => {
  it("loads all department pages and optionally loads members", async () => {
    const calls: string[] = [];
    const api = {
      getDepartmentChildren: async ({ pageToken }: { pageToken?: string }) => {
        calls.push(`departments:${pageToken ?? "first"}`);
        return pageToken
          ? { items: [{ department_id: "dept-2", name: "研发部" }], has_more: false }
          : {
              items: [{ department_id: "dept-1", name: "产品部", has_child: true }],
              has_more: true,
              page_token: "dept-page-2",
            };
      },
      getDepartmentUsers: async ({ pageToken }: { pageToken?: string }) => {
        calls.push(`users:${pageToken ?? "first"}`);
        return { items: [{ user_id: "user-1", nickname: "张三" }], has_more: false };
      },
      searchUsers: async () => ({ items: [], has_more: false }),
    } as never;
    const adapters = createContactOrganizationSelectorAdapters(api);

    const items = await adapters.loadChildren({
      parentId: "-1",
      includeMembers: true,
    });

    assert.deepEqual(calls, [
      "departments:first",
      "users:first",
      "departments:dept-page-2",
    ]);
    assert.deepEqual(
      items.map((item) => [item.id, item.type, (item as { dataType?: string }).dataType]),
      [
        ["dept-1", "department", "department"],
        ["dept-2", "department", "department"],
        ["user-1", "user", "user"],
      ],
    );
  });

  it("does not request members when the selector only browses departments", async () => {
    let usersRequested = false;
    const api = {
      getDepartmentChildren: async () => ({ items: [{ id: "dept-1", name: "产品部" }] }),
      getDepartmentUsers: async () => {
        usersRequested = true;
        return { items: [] };
      },
      searchUsers: async () => ({ items: [] }),
    } as never;
    const adapters = createContactOrganizationSelectorAdapters(api);

    await adapters.loadChildren({ parentId: "-1", includeMembers: false });
    assert.equal(usersRequested, false);
  });

  it("normalizes search pagination and returns legacy selector dataType", async () => {
    const api = {
      getDepartmentChildren: async () => ({ items: [] }),
      getDepartmentUsers: async () => ({ items: [] }),
      searchUsers: async () => ({
        items: [{ user_id: "user-1", real_name: "李四" }],
        has_more: true,
        next_page_token: "next-page",
      }),
    } as never;
    const adapters = createContactOrganizationSelectorAdapters(api);

    const result = await adapters.searchMembers({ query: "李四" });
    assert.equal(result.hasMore, true);
    assert.equal(result.pageToken, "next-page");
    assert.deepEqual(result.items[0], {
      user_id: "user-1",
      real_name: "李四",
      id: "user-1",
      name: "李四",
      type: "user",
      dataType: "user",
      avatarUrl: undefined,
      description: "",
      raw: { user_id: "user-1", real_name: "李四" },
    });
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDataDashboardContactOrganizationSelectorAdapters } from "../../../src/components/organization-selectors/data-dashboard-contact.ts";

describe("data dashboard contact organization selector adapter", () => {
  it("keeps hidden departments and users as ordinary selectable nodes", async () => {
    const calls: string[] = [];
    const api = {
      getDepartmentChildren: async ({ departmentId, pageToken, sumType }: { departmentId?: string; pageToken?: string; sumType?: number }) => {
        calls.push(`departments:${departmentId}:${pageToken ?? "first"}:${sumType}`);
        return pageToken
          ? { items: [{ department_id: "hidden-dept-2", name: "隐藏研发", option: 1 }], has_more: false }
          : {
              items: [{ department_id: "hidden-dept-1", name: "隐藏产品", option: 1, has_child: true }],
              has_more: true,
              page_token: "department-page-2",
            };
      },
      getDepartmentUsers: async ({ departmentId, pageToken, recursive }: { departmentId?: string; pageToken?: string; recursive?: number }) => {
        calls.push(`users:${departmentId}:${pageToken ?? "first"}:${recursive}`);
        return pageToken
          ? { items: [{ user_id: "hidden-user-2", real_name: "隐藏用户二", visible: false }], has_more: false }
          : {
              items: [{ user_id: "hidden-user-1", nickname: "隐藏用户一", visible: false }],
              has_more: true,
              page_token: "user-page-2",
            };
      },
      searchUsers: async () => ({ items: [] }),
      searchDepartments: async () => ({ items: [] }),
    } as never;
    const adapters = createDataDashboardContactOrganizationSelectorAdapters(api);

    const items = await adapters.loadChildren({ parentId: "dept-root", includeMembers: true });

    assert.deepEqual(calls, [
      "departments:dept-root:first:2",
      "users:dept-root:first:0",
      "departments:dept-root:department-page-2:2",
      "users:dept-root:user-page-2:0",
    ]);
    assert.deepEqual(
      items.map((item) => ({ id: item.id, name: item.name, type: item.type, dataType: item.dataType })),
      [
        { id: "hidden-dept-1", name: "隐藏产品", type: "department", dataType: "department" },
        { id: "hidden-dept-2", name: "隐藏研发", type: "department", dataType: "department" },
        { id: "hidden-user-1", name: "隐藏用户一", type: "user", dataType: "user" },
        { id: "hidden-user-2", name: "隐藏用户二", type: "user", dataType: "user" },
      ],
    );
    assert.equal((items[0]?.raw as { option?: number }).option, 1);
    assert.equal((items[2]?.raw as { visible?: boolean }).visible, false);
    assert.equal((items[0] as { memberCount?: number }).memberCount, undefined);
  });

  it("routes member and department keywords to separate backend searches", async () => {
    const calls: Array<{ type: string; params: Record<string, unknown> }> = [];
    const api = {
      getDepartmentChildren: async () => ({ items: [] }),
      getDepartmentUsers: async () => ({ items: [] }),
      searchUsers: async (params: Record<string, unknown>) => {
        calls.push({ type: "users", params });
        return {
          items: [{ user_id: "user-1", nickname: "张三", path_nodes: [{ department_name: "隐藏部门", visible: false }] }],
          has_more: true,
          next_page_token: "user-next",
        };
      },
      searchDepartments: async (params: Record<string, unknown>) => {
        calls.push({ type: "departments", params });
        return {
          items: [{ department_id: "dept-1", name: "隐藏部门", option: 1 }],
          has_more: true,
          page_token: "department-next",
        };
      },
    } as never;
    const adapters = createDataDashboardContactOrganizationSelectorAdapters(api);
    const signal = new AbortController().signal;

    const [members, departments] = await Promise.all([
      adapters.searchMembers({ query: "  张三 ", signal }),
      adapters.searchDepartments({ query: "  隐藏部门 ", signal }),
    ]);

    assert.deepEqual(calls, [
      {
        type: "users",
        params: { pageToken: undefined, query: "张三", queryType: 1, filterAgent: 0 },
      },
      {
        type: "departments",
        params: { pageToken: undefined, name: "隐藏部门", sumType: 1 },
      },
    ]);
    assert.equal(members.hasMore, true);
    assert.equal(members.pageToken, "user-next");
    assert.equal(members.items[0]?.id, "user-1");
    assert.equal(members.items[0]?.name, "张三");
    assert.equal((members.items[0]?.raw as { path_nodes?: unknown[] }).path_nodes?.length, 1);
    assert.equal(departments.hasMore, true);
    assert.equal(departments.pageToken, "department-next");
    assert.equal(departments.items[0]?.id, "dept-1");
    assert.equal(departments.items[0]?.type, "department");
    assert.equal((departments.items[0]?.raw as { option?: number }).option, 1);
  });

  it("does not call either search endpoint for blank keywords", async () => {
    let requestCount = 0;
    const api = {
      getDepartmentChildren: async () => ({ items: [] }),
      getDepartmentUsers: async () => ({ items: [] }),
      searchUsers: async () => {
        requestCount += 1;
        return { items: [] };
      },
      searchDepartments: async () => {
        requestCount += 1;
        return { items: [] };
      },
    } as never;
    const adapters = createDataDashboardContactOrganizationSelectorAdapters(api);

    assert.deepEqual(await adapters.searchMembers({ query: "   " }), { items: [], hasMore: false });
    assert.deepEqual(await adapters.searchDepartments({ query: "\t" }), { items: [], hasMore: false });
    assert.equal(requestCount, 0);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDataDashboardContactApi } from "../../../src/api/data-dashboard-contact/api.ts";

describe("data dashboard contact API", () => {
  it("uses the dedicated admin endpoints and dashboard query parameters", async () => {
    const requests: Array<{ url: string; options?: unknown }> = [];
    const client = {
      get: async (url: string, options?: unknown) => {
        requests.push({ url, options });
        return { items: [], has_more: false };
      },
    } as never;
    const api = createDataDashboardContactApi(client);
    const signal = new AbortController().signal;

    await api.getDepartmentChildren({ departmentId: "dept-1", pageToken: "dept-page", sumType: 2 }, { signal });
    await api.getDepartmentUsers({ departmentId: "dept-1", pageToken: "user-page", recursive: 0 }, { signal });
    await api.searchUsers(
      { query: "张三", pageToken: "search-page", queryType: 3, filterAgent: 1 },
      { signal },
    );
    await api.searchDepartments({ name: "研发", pageToken: "department-page", sumType: 2 }, { signal });

    assert.deepEqual(requests, [
      {
        url: "/api/v1/admin/data-dashboard/contact/departments/dept-1/children?page_token=dept-page&sum_type=2",
        options: { signal },
      },
      {
        url: "/api/v1/admin/data-dashboard/contact/departments/dept-1/users?page_token=user-page&recursive=0",
        options: { signal },
      },
      {
        url: "/api/v1/admin/data-dashboard/contact/users/search?page_token=search-page&query=%E5%BC%A0%E4%B8%89&query_type=3&filter_agent=1",
        options: { signal },
      },
      {
        url: "/api/v1/admin/data-dashboard/contact/departments/search?page_token=department-page&name=%E7%A0%94%E5%8F%91&sum_type=2",
        options: { signal },
      },
    ]);
  });

  it("uses the documented defaults without sending legacy pagination parameters", async () => {
    const requests: string[] = [];
    const client = {
      get: async (url: string) => {
        requests.push(url);
        return { items: [] };
      },
    } as never;
    const api = createDataDashboardContactApi(client);

    await api.getDepartmentChildren();
    await api.getDepartmentUsers({ departmentId: "dept-1" });
    await api.searchUsers({ query: "张三" });
    await api.searchDepartments({ name: "研发" });

    assert.deepEqual(requests, [
      "/api/v1/admin/data-dashboard/contact/departments/-1/children?sum_type=2",
      "/api/v1/admin/data-dashboard/contact/departments/dept-1/users?page_token=&recursive=0",
      "/api/v1/admin/data-dashboard/contact/users/search?query=%E5%BC%A0%E4%B8%89&query_type=1&filter_agent=0",
      "/api/v1/admin/data-dashboard/contact/departments/search?name=%E7%A0%94%E5%8F%91&sum_type=1",
    ]);

    assert.equal(requests.some((url) => url.includes("count=")), false);
    assert.equal(requests.some((url) => url.includes("is_recursive=")), false);
  });
});

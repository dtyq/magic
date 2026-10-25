import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createContactOrganizationApi } from "../../../src/api/contact-organization/api.ts";

describe("contact organization API", () => {
  it("uses the shared Magic contact endpoints and default parameters", async () => {
    const requests: Array<{ url: string; options?: unknown }> = [];
    const client = {
      get: async (url: string, options?: unknown) => {
        requests.push({ url, options });
        return { items: [] };
      },
    } as never;
    const api = createContactOrganizationApi(client);
    const signal = new AbortController().signal;

    await api.getDepartmentChildren({}, { signal });
    await api.getDepartmentUsers({ departmentId: "dept-1" }, { signal });
    await api.searchUsers({ query: "张三" }, { signal });

    assert.deepEqual(requests, [
      {
        url: "/api/v1/contact/departments/-1/children?sum_type=2",
        options: { signal },
      },
      {
        url: "/api/v1/contact/departments/dept-1/users?count=50&is_recursive=0&page_token=",
        options: { signal },
      },
      {
        url: "/api/v2/magic/contact/user/searchForSelect?query=%E5%BC%A0%E4%B8%89&query_type=1",
        options: { signal },
      },
    ]);
  });
});

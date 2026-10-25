import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { RequestUrl } from "../../../src/api/constants/index.ts";
import type { HttpClient, RequestOptions } from "../../../src/api/types.ts";
import { createPlatformProviderApi } from "../../../src/features/platform-provider-list/api.ts";
import { providerListKeys } from "../../../src/features/platform-provider-list/queries.ts";
import {
  providerCategory,
  providerStatus,
  type AddProviderParams,
  type UpdateProviderParams,
} from "../../../src/features/platform-provider-list/types.ts";

type RecordedCall = {
  data?: unknown;
  method: "delete" | "get" | "post" | "put";
  options?: RequestOptions;
  url: string;
};

class RecordingHttpClient implements HttpClient {
  calls: RecordedCall[] = [];

  async get<T>(url: string, options?: RequestOptions): Promise<T> {
    this.calls.push({ method: "get", options, url });
    return undefined as T;
  }

  async post<T, D = unknown>(url: string, data?: D, options?: RequestOptions): Promise<T> {
    this.calls.push({ data, method: "post", options, url });
    return undefined as T;
  }

  async put<T, D = unknown>(url: string, data?: D, options?: RequestOptions): Promise<T> {
    this.calls.push({ data, method: "put", options, url });
    return undefined as T;
  }

  async patch<T, D = unknown>(url: string, data?: D, options?: RequestOptions): Promise<T> {
    this.calls.push({ data, method: "put", options, url });
    return undefined as T;
  }

  async delete<T, D = unknown>(url: string, data?: D, options?: RequestOptions): Promise<T> {
    this.calls.push({ data, method: "delete", options, url });
    return undefined as T;
  }
}

const mutationSource = readFileSync(
  "src/features/platform-provider-list/mutations.ts",
  "utf8",
);
const querySource = readFileSync("src/features/platform-provider-list/queries.ts", "utf8");

describe("platform provider API and query contract", () => {
  it("keeps the legacy platform provider endpoint paths", () => {
    assert.equal(RequestUrl.providerList, "/api/v1/admin/service-providers");
    assert.equal(
      RequestUrl.providerTemplates,
      "/api/v1/admin/service-providers/templates/queries",
    );
    assert.equal(RequestUrl.providerDetail, "/api/v1/admin/service-providers/${id}");
  });

  it("requests lists and templates with the selected category and abort signal", async () => {
    const client = new RecordingHttpClient();
    const api = createPlatformProviderApi(client);
    const controller = new AbortController();

    await api.getProviderList(providerCategory.vlm, undefined, { signal: controller.signal });
    await api.getProviderTemplates(providerCategory.vgm, { signal: controller.signal });

    assert.deepEqual(client.calls, [
      {
        method: "get",
        options: { signal: controller.signal },
        url: "/api/v1/admin/service-providers?category=vlm",
      },
      {
        method: "get",
        options: { signal: controller.signal },
        url: "/api/v1/admin/service-providers/templates/queries?category=vgm",
      },
    ]);
  });

  it("supports an organization endpoint override without changing list parameters", async () => {
    const client = new RecordingHttpClient();
    const api = createPlatformProviderApi(client);

    await api.getProviderList(
      providerCategory.llm,
      "/api/v1/organization/admin/service-providers",
    );

    assert.deepEqual(client.calls[0], {
      method: "get",
      options: undefined,
      url: "/api/v1/organization/admin/service-providers?category=llm",
    });
  });

  it("requests encoded details and forwards add, update, and delete payloads", async () => {
    const client = new RecordingHttpClient();
    const api = createPlatformProviderApi(client);
    const addPayload: AddProviderParams = {
      alias: "OpenAI",
      service_provider_id: "template-1",
      status: providerStatus.enabled,
      config: { api_key: "key" },
    };
    const updatePayload: UpdateProviderParams = {
      id: "provider 1",
      alias: "OpenAI",
      sort: 1,
      status: providerStatus.disabled,
      provider_code: "OpenAI",
      config: { api_key: "key" },
      translate: { alias: { zh_CN: "OpenAI" } },
    };

    await api.getProviderDetail("provider 1");
    await api.addProvider(addPayload);
    await api.updateProvider(updatePayload);
    await api.deleteProvider("provider 1");

    assert.deepEqual(client.calls, [
      {
        method: "get",
        options: undefined,
        url: "/api/v1/admin/service-providers/provider%201",
      },
      {
        data: addPayload,
        method: "post",
        options: undefined,
        url: "/api/v1/admin/service-providers",
      },
      {
        data: updatePayload,
        method: "put",
        options: undefined,
        url: "/api/v1/admin/service-providers",
      },
      {
        data: undefined,
        method: "delete",
        options: undefined,
        url: "/api/v1/admin/service-providers/provider%201",
      },
    ]);
  });

  it("separates list, detail, template, platform, and organization query keys", () => {
    assert.deepEqual(providerListKeys.list(providerCategory.llm), [
      "platform-provider-list",
      "list",
      "llm",
    ]);
    assert.deepEqual(providerListKeys.detail("provider-1"), [
      "platform-provider-list",
      "detail",
      "provider-1",
    ]);
    assert.deepEqual(providerListKeys.templates(providerCategory.vlm), [
      "platform-provider-list",
      "templates",
      "vlm",
    ]);
    assert.equal(querySource.includes("const key = options?.key ?? \"platform\""), true);
    assert.equal(querySource.includes("queryKey: [...providerListKeys.list(category), key]"), true);
  });

  it("forwards query abort signals and keeps delete refreshes scoped to provider lists", () => {
    assert.equal(
      querySource.includes("platformProviders.getProviderList(category, endpoint, { signal })"),
      true,
    );
    assert.equal(
      querySource.includes("platformProviders.getProviderDetail(id ?? \"\", { signal })"),
      true,
    );
    assert.equal(
      querySource.includes("platformProviders.getProviderTemplates(category, { signal })"),
      true,
    );
    assert.equal(
      mutationSource.match(/invalidateQueries\(\{ queryKey: providerListKeys\.all \}\)/g)?.length,
      2,
    );
    assert.equal(
      mutationSource.includes('predicate: ({ queryKey }) => queryKey[1] === "list"'),
      true,
    );
    assert.equal(
      mutationSource.includes(
        'queryClient.cancelQueries({ queryKey: providerListKeys.detail(id) })',
      ),
      true,
    );
    assert.equal(
      mutationSource.includes(
        'queryClient.removeQueries({ queryKey: providerListKeys.detail(id) })',
      ),
      true,
    );
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import PlatformProviderListPage from "../../../src/features/platform-provider-list/platform-provider-list-page";
import { ProviderAddDialog } from "../../../src/features/platform-provider-list/components/provider-add-dialog";
import { ProviderConfigDialog } from "../../../src/features/platform-provider-list/components/provider-config-dialog";
import { ProviderListContent } from "../../../src/features/platform-provider-list/components/provider-list-content";
import { ProviderStatusSwitch } from "../../../src/features/platform-provider-list/components/provider-status-switch";
import type { ProviderCategoryAccessMap } from "../../../src/features/platform-provider-list/permissions";
import { RuntimeContext, type RuntimeValue } from "../../../src/runtime/context";
import {
  providerCategory,
  providerStatus,
  providerType,
  type ProviderListItem,
  type ProviderTemplate,
} from "../../../src/features/platform-provider-list/types";
import { createDefaultProviderFilterDraft } from "../../../src/features/platform-provider-list/utils/provider-list";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

Object.defineProperty(Element.prototype, "scrollIntoView", {
  configurable: true,
  value: vi.fn(),
});

for (const method of ["hasPointerCapture", "setPointerCapture", "releasePointerCapture"] as const) {
  Object.defineProperty(Element.prototype, method, {
    configurable: true,
    value: method === "hasPointerCapture" ? vi.fn(() => false) : vi.fn(),
  });
}

const categoryAccess: ProviderCategoryAccessMap = {
  [providerCategory.llm]: { canView: true, canEdit: true },
  [providerCategory.vlm]: { canView: true, canEdit: false },
  [providerCategory.vgm]: { canView: false, canEdit: false },
};

const enabledProvider: ProviderListItem = {
  id: "provider-1",
  name: "OpenAI",
  alias: "OpenAI Alias",
  translate: { alias: { zh_CN: "OpenAI Alias", en_US: "OpenAI Alias" } },
  sort: 1,
  status: providerStatus.enabled,
  service_provider_id: "template-1",
  provider_code: "OpenAI",
  provider_type: providerType.nonOfficial,
  category: providerCategory.llm,
  config: { api_key: "secret", url: "https://api.openai.com/v1" },
  created_at: "2026-08-01 12:00:00",
};

const readonlyProvider: ProviderListItem = {
  ...enabledProvider,
  id: "provider-2",
  name: "Official Provider",
  provider_type: providerType.official,
  category: providerCategory.vlm,
  status: providerStatus.disabled,
};

const template: ProviderTemplate = {
  id: "template-1",
  name: "OpenAI",
  provider_code: "OpenAI",
  provider_type: providerType.nonOfficial,
  category: providerCategory.llm,
};

function renderList(overrides: Partial<Parameters<typeof ProviderListContent>[0]> = {}) {
  const props = {
    categoryAccess,
    deleting: false,
    filter: createDefaultProviderFilterDraft(),
    items: [enabledProvider, readonlyProvider],
    loading: false,
    onDelete: vi.fn().mockResolvedValue(undefined),
    onFilterChange: vi.fn(),
    onOpenDetail: vi.fn(),
    onPageChange: vi.fn(),
    onStatusChange: vi.fn().mockResolvedValue(undefined),
    page: 1,
    stats: { total: 2, enabled: 1, disabled: 1 },
    statusPendingIds: new Set<string>(),
    total: 2,
    ...overrides,
  };

  return {
    ...render(
      // Radix exposes its structured native select only inside a form; using it here
      // avoids jsdom-only portal/focus timing while still exercising the real change event.
      <form onSubmit={(event) => event.preventDefault()}>
        <ProviderListContent {...props} />
      </form>,
    ),
    props,
  };
}

function renderProviderPage(platformProviders: Record<string, ReturnType<typeof vi.fn>>) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  const runtimeValue = {
    access: {
      organizationCode: "org-1",
      hasTeamshareAllPermissions: false,
      isOfficialOrganization: false,
      isPersonalOrganization: false,
      magicPermissionKeys: ["platform.ai.model_management.edit"],
      teamsharePermissionKeys: [],
      user: { id: "user-1", name: "Test User" },
      organization: { organizationCode: "org-1", name: "Test Organization" },
    },
    apis: { platformProviders },
  } as unknown as RuntimeValue;

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <RuntimeContext.Provider value={runtimeValue}>
          <PlatformProviderListPage />
        </RuntimeContext.Provider>
      </QueryClientProvider>,
    ),
  };
}

// Prefer Radix's runtime-generated native select over portal-only option clicks in jsdom.
function changeNativeSelectOption(optionText: string) {
  const normalizedText = optionText.replace(/\s+/g, " ").trim();
  const option = Array.from(document.querySelectorAll<HTMLOptionElement>("select option")).find(
    (element) => element.textContent?.replace(/\s+/g, " ").trim() === normalizedText,
  );
  expect(option).toBeDefined();
  const select = option?.parentElement;
  expect(select).toBeInstanceOf(HTMLSelectElement);
  fireEvent.change(select!, { target: { value: option!.value } });
}

function renderConfig(
  overrides: Partial<Parameters<typeof ProviderConfigDialog>[0]> = {},
) {
  const props = {
    canEdit: true,
    deleting: false,
    error: null,
    loading: false,
    onDelete: vi.fn().mockResolvedValue(undefined),
    onOpenChange: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(undefined),
    provider: enabledProvider,
    providerId: enabledProvider.id,
    saving: false,
    ...overrides,
  };

  return { ...render(<ProviderConfigDialog {...props} />), props };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("platform provider components", () => {
  it("toggles an enabled provider and keeps disabled or loading switches inert", () => {
    const onChange = vi.fn();

    render(
      <div>
        <ProviderStatusSwitch onChange={onChange} provider={enabledProvider} />
        <ProviderStatusSwitch disabled onChange={onChange} provider={enabledProvider} />
        <ProviderStatusSwitch loading onChange={onChange} provider={enabledProvider} />
      </div>,
    );

    const switches = screen.getAllByRole("switch");
    expect(switches[0]).toHaveAttribute("aria-checked", "true");
    fireEvent.click(switches[0]);
    fireEvent.click(switches[1]);
    fireEvent.click(switches[2]);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(false);
    expect(switches[1]).toBeDisabled();
    expect(switches[2]).toHaveAttribute("aria-busy", "true");
  });

  it("updates independent search inputs, select filters, row actions, and per-row status", async () => {
    const onFilterChange = vi.fn();
    const onOpenDetail = vi.fn();
    const onStatusChange = vi.fn().mockResolvedValue(undefined);
    const filter = createDefaultProviderFilterDraft();

    const { unmount } = renderList({ filter, onFilterChange, onOpenDetail, onStatusChange });

    // Name, alias and provider ID are independent fields instead of a field selector.
    fireEvent.change(screen.getByPlaceholderText("providerList.filter.name"), {
      target: { value: "open" },
    });
    expect(onFilterChange).toHaveBeenLastCalledWith({ ...filter, name: "open" });
    fireEvent.change(screen.getByPlaceholderText("providerList.filter.alias"), {
      target: { value: "oa" },
    });
    expect(onFilterChange).toHaveBeenLastCalledWith({ ...filter, alias: "oa" });
    fireEvent.change(screen.getByPlaceholderText("providerList.filter.providerId"), {
      target: { value: "code" },
    });
    expect(onFilterChange).toHaveBeenLastCalledWith({ ...filter, id: "code" });

    const comboboxes = screen.getAllByRole("combobox");
    fireEvent.click(comboboxes[0]);
    fireEvent.click(await screen.findByRole("option", { name: "providerList.status.enabled" }));
    expect(onFilterChange).toHaveBeenLastCalledWith({
      ...filter,
      status: String(providerStatus.enabled),
    });

    fireEvent.click(comboboxes[1]);
    fireEvent.click(await screen.findByRole("option", { name: "providerList.providerType.nonOfficial" }));
    expect(onFilterChange).toHaveBeenLastCalledWith({
      ...filter,
      provider_type: String(providerType.nonOfficial),
    });

    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[0]);
    fireEvent.click(switches[1]);
    expect(onStatusChange).toHaveBeenCalledTimes(1);
    expect(onStatusChange).toHaveBeenCalledWith(enabledProvider, false);

    fireEvent.click(screen.getByRole("button", { name: "providerList.action.configure" }));
    expect(onOpenDetail).toHaveBeenCalledWith(enabledProvider);
    expect(screen.getByRole("button", { name: "providerList.action.view" })).toBeInTheDocument();
    unmount();
  });

  it("marks only the requested row as pending", () => {
    renderList({ statusPendingIds: new Set([enabledProvider.id]) });

    const switches = screen.getAllByRole("switch");
    expect(switches[0]).toHaveAttribute("aria-busy", "true");
    expect(switches[0]).toBeDisabled();
    expect(switches[1]).not.toHaveAttribute("aria-busy");
  });

  it("confirms deletion from the list only for editable non-official providers", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);

    renderList({ onDelete });

    const deleteButton = screen.getByRole("button", { name: "common.delete" });
    fireEvent.click(deleteButton);

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("providerList.delete.title")).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "common.delete" }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(enabledProvider));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(document.body).not.toHaveStyle({ pointerEvents: "none" });
  });

  it("disables the template selector while templates are loading", () => {
    render(
      <ProviderAddDialog
        category={providerCategory.llm}
        editableCategories={[providerCategory.llm]}
        onCategoryChange={vi.fn()}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        open
        submitting={false}
        templates={[template]}
        templatesLoading
      />,
    );

    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes[1]).toBeDisabled();
  });

  it("selects a template, resets its connection config, and submits the selected template", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <ProviderAddDialog
        category={providerCategory.llm}
        editableCategories={[providerCategory.llm]}
        onCategoryChange={vi.fn()}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        open
        submitting={false}
        templates={[template]}
        templatesLoading={false}
      />,
    );

    const templateSelect = Array.from(document.querySelectorAll("select")).find((select) =>
      Array.from(select.options).some((option) => option.value === template.id),
    );
    expect(templateSelect).toBeDefined();
    fireEvent.change(templateSelect!, { target: { value: template.id } });

    expect(screen.getByDisplayValue("https://api.openai.com/v1")).toHaveValue(
      "https://api.openai.com/v1",
    );
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ service_provider_id: template.id, status: false }),
      template,
    );
  });

  it("does not request the deleted provider detail again", async () => {
    const getProviderList = vi.fn().mockResolvedValue([enabledProvider]);
    const getProviderDetail = vi.fn().mockResolvedValue(enabledProvider);
    const deleteProvider = vi.fn().mockResolvedValue(null);
    const platformProviders = {
      addProvider: vi.fn(),
      deleteProvider,
      getProviderDetail,
      getProviderList,
      getProviderTemplates: vi.fn().mockResolvedValue([template]),
      updateProvider: vi.fn(),
    };

    renderProviderPage(platformProviders);

    fireEvent.click(await screen.findByRole("button", { name: "providerList.action.configure" }));
    await waitFor(() =>
      expect(getProviderDetail).toHaveBeenCalledWith(enabledProvider.id, expect.anything()),
    );
    expect(getProviderDetail).toHaveBeenCalledTimes(1);

    const detailDialog = await screen.findByRole("dialog");
    fireEvent.click(within(detailDialog).getByRole("button", { name: "common.delete" }));
    const confirmDialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirmDialog).getByRole("button", { name: "common.delete" }));

    await waitFor(() =>
      expect(deleteProvider).toHaveBeenCalledWith(enabledProvider.id),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(getProviderDetail).toHaveBeenCalledTimes(1);
  });

  it("opens the delete confirmation and confirms deletion for editable non-official providers", async () => {
    const { props } = renderConfig();

    fireEvent.click(screen.getByRole("button", { name: "common.delete" }));
    const alertDialog = await screen.findByRole("alertdialog");
    expect(within(alertDialog).getByText("providerList.delete.title")).toBeInTheDocument();

    const deleteButtons = screen.getAllByRole("button", { name: "common.delete" });
    fireEvent.click(deleteButtons.at(-1)!);

    await waitFor(() => {
      expect(props.onDelete).toHaveBeenCalledWith(enabledProvider);
      expect(props.onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(props.onDelete.mock.invocationCallOrder[0]).toBeLessThan(
      props.onOpenChange.mock.invocationCallOrder[0],
    );
  });

  it("keeps the confirmation open when deletion fails", async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error("delete failed"));
    const { props } = renderConfig({ onDelete });

    fireEvent.click(screen.getByRole("button", { name: "common.delete" }));
    const alertDialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(alertDialog).getByRole("button", { name: "common.delete" }));

    await waitFor(() => expect(props.onDelete).toHaveBeenCalledWith(enabledProvider));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });

  it("restores page interactivity when detail and confirmation dialogs close", async () => {
    function TestHarness() {
      const [providerId, setProviderId] = useState<string | null>(enabledProvider.id);

      return (
        <ProviderConfigDialog
          canEdit
          deleting={false}
          loading={false}
          onDelete={vi.fn().mockResolvedValue(undefined)}
          onOpenChange={(open) => {
            if (!open) setProviderId(null);
          }}
          onSubmit={vi.fn().mockResolvedValue(undefined)}
          provider={providerId ? enabledProvider : null}
          providerId={providerId}
          saving={false}
        />
      );
    }

    render(<TestHarness />);
    fireEvent.click(screen.getByRole("button", { name: "common.delete" }));
    const alertDialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(alertDialog).getByRole("button", { name: "common.delete" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(document.body).not.toHaveStyle({ pointerEvents: "none" });
  });

  it("keeps the detail dialog open when deletion is canceled", async () => {
    const { props } = renderConfig();

    fireEvent.click(screen.getByRole("button", { name: "common.delete" }));
    const alertDialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(alertDialog).getByRole("button", { name: "common.cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("providerList.field.alias"), {
      target: { value: "Changed after cancel" },
    });
    expect(screen.getByLabelText("providerList.field.alias")).toHaveValue("Changed after cancel");
    expect(props.onDelete).not.toHaveBeenCalled();
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });

  it("hides deletion for official providers and disables all editing in read-only mode", () => {
    const { rerender } = renderConfig({
      canEdit: false,
      provider: readonlyProvider,
      providerId: readonlyProvider.id,
    });

    expect(screen.queryByRole("button", { name: "common.delete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "common.save" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("providerList.field.alias")).toBeDisabled();

    rerender(
      <ProviderConfigDialog
        canEdit
        deleting={false}
        loading={false}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        provider={{ ...readonlyProvider, provider_type: providerType.official }}
        providerId={readonlyProvider.id}
        saving={false}
      />,
    );

    expect(screen.queryByRole("button", { name: "common.delete" })).not.toBeInTheDocument();
  });

  it("keeps save disabled until a configuration form becomes dirty", () => {
    renderConfig();

    const save = screen.getByRole("button", { name: "common.save" });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByLabelText("providerList.field.alias"), {
      target: { value: "Updated alias" },
    });
    expect(save).not.toBeDisabled();
  });

  it("preserves the current form values when the config save resolves", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderConfig({ onSubmit });

    fireEvent.change(screen.getByLabelText("providerList.field.alias"), {
      target: { value: "Updated alias" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      enabledProvider,
      expect.objectContaining({ alias: "Updated alias" }),
    );
    expect(screen.getByRole("button", { name: "common.save" })).toBeDisabled();
  });
});

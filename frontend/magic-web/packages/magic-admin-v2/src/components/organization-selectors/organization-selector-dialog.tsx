import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useDebounce } from "ahooks";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FilterSearchInput } from "@magic-admin-v2/components/filter-search-input";
import { Button } from "@magic-admin-v2/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@magic-admin-v2/components/ui/dialog";
import { useTranslation } from "react-i18next";
import {
  SelectionSummary,
  SelectorRow,
  SelectorState,
} from "./selector-components";
import type {
  BaseSelectorDialogProps,
  OrganizationSelectorNode,
  SelectionMap,
} from "./types";
import {
  getErrorMessage,
  getNodeKey,
  isNodeSelectable,
  mergeNodes,
  resolveMembersFromSelection,
} from "./utils";

const defaultRootId = "-1";

export function OrganizationSelectorDialog({
  cancelLabel,
  confirmLabel,
  convertDepartmentsToMembers = false,
  dialogContentTestId,
  searchInputTestId,
  clearSearchButtonTestId,
  rootButtonTestId,
  breadcrumbButtonTestId,
  backButtonTestId,
  loadingTestId,
  errorTestId,
  emptyTestId,
  rowTestId,
  nodeButtonTestId,
  checkboxTestId,
  enterButtonTestId,
  loadMoreButtonTestId,
  cancelButtonTestId,
  confirmButtonTestId,
  defaultSelectedValues,
  description,
  disabled,
  emptyLabel,
  includeMembers,
  loadChildren,
  maxSelected,
  onConfirm,
  onOpenChange,
  onSelectionChange,
  open,
  rootId = defaultRootId,
  rootName,
  searchMembers,
  searchPlaceholder,
  selectableTypes,
  selectedValues,
  title,
}: BaseSelectorDialogProps) {
  const { t } = useTranslation();
  const [path, setPath] = useState<OrganizationSelectorNode[]>([]);
  const [items, setItems] = useState<OrganizationSelectorNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, { wait: 350 });
  const [searchItems, setSearchItems] = useState<OrganizationSelectorNode[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchPageToken, setSearchPageToken] = useState<string | undefined>();
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [internalSelected, setInternalSelected] = useState<OrganizationSelectorNode[]>(
    defaultSelectedValues ?? [],
  );

  const isControlled = selectedValues !== undefined;
  const selected = isControlled ? selectedValues : internalSelected;
  const currentParentId = path[path.length - 1]?.id ?? rootId;
  const isSearchMode = Boolean(debouncedQuery.trim() && searchMembers);
  const visibleItems = useMemo(() => {
    if (isSearchMode) {
      return searchItems;
    }
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery || searchMembers) {
      return items;
    }
    return items.filter((item) => item.name.toLowerCase().includes(normalizedQuery));
  }, [isSearchMode, items, query, searchItems, searchMembers]);

  const selectedMap = useMemo<SelectionMap>(() => {
    return new Map(selected.map((item) => [getNodeKey(item), item]));
  }, [selected]);

  const selectedDepartments = useMemo(
    () => selected.filter((item) => item.type === "department").length,
    [selected],
  );
  const selectedMembers = selected.length - selectedDepartments;

  const emitSelectionChange = useCallback(
    (nextSelected: OrganizationSelectorNode[]) => {
      if (!isControlled) {
        setInternalSelected(nextSelected);
      }
      onSelectionChange?.(nextSelected);
    },
    [isControlled, onSelectionChange],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);

    loadChildren({
      parentId: currentParentId,
      includeMembers,
      signal: controller.signal,
    })
      .then((nextItems) => {
        if (!controller.signal.aborted) {
          setItems(nextItems);
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setLoadError(getErrorMessage(error, t("organizationSelector.error.loadFailed")));
          setItems([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [currentParentId, includeMembers, loadChildren, open, t]);

  useEffect(() => {
    if (!open || !searchMembers) {
      return;
    }

    const normalizedQuery = debouncedQuery.trim();
    if (!normalizedQuery) {
      setSearchItems([]);
      setSearchHasMore(false);
      setSearchPageToken(undefined);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    setIsSearching(true);
    setSearchError(null);

    searchMembers({
      query: normalizedQuery,
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) {
          setSearchItems(result.items);
          setSearchHasMore(Boolean(result.hasMore));
          setSearchPageToken(result.pageToken);
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setSearchError(getErrorMessage(error, t("organizationSelector.error.loadFailed")));
          setSearchItems([]);
          setSearchHasMore(false);
          setSearchPageToken(undefined);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      });

    return () => controller.abort();
  }, [debouncedQuery, open, searchMembers, t]);

  useEffect(() => {
    if (open) {
      if (!isControlled) {
        setInternalSelected(defaultSelectedValues ?? []);
      }
      return;
    }
    setPath([]);
    setItems([]);
    setQuery("");
    setSearchItems([]);
    setSearchError(null);
    setLoadError(null);
    setSearchHasMore(false);
    setSearchPageToken(undefined);
  }, [defaultSelectedValues, isControlled, open]);

  const handleToggle = (node: OrganizationSelectorNode) => {
    if (!isNodeSelectable(node, selectableTypes) || node.disabled) {
      return;
    }

    const nodeKey = getNodeKey(node);
    if (selectedMap.has(nodeKey)) {
      emitSelectionChange(selected.filter((item) => getNodeKey(item) !== nodeKey));
      return;
    }

    if (maxSelected === 1 && selected.length >= maxSelected) {
      emitSelectionChange([node]);
      return;
    }

    if (maxSelected && selected.length >= maxSelected) {
      return;
    }

    emitSelectionChange([...selected, node]);
  };

  const handleEnterDepartment = (node: OrganizationSelectorNode) => {
    if (node.type !== "department") {
      return;
    }
    setPath((currentPath) => [...currentPath, node]);
    setQuery("");
  };

  const handleBreadcrumbClick = (index: number) => {
    setPath((currentPath) => currentPath.slice(0, index));
    setQuery("");
  };

  const handleLoadMore = async () => {
    const normalizedQuery = debouncedQuery.trim();
    if (!searchMembers || !normalizedQuery || !searchHasMore || isSearching) {
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    try {
      const result = await searchMembers({
        query: normalizedQuery,
        pageToken: searchPageToken,
      });
      setSearchItems((currentItems) => mergeNodes(currentItems, result.items));
      setSearchHasMore(Boolean(result.hasMore));
      setSearchPageToken(result.pageToken);
    } catch (error) {
      setSearchError(getErrorMessage(error, t("organizationSelector.error.loadFailed")));
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      const confirmed = convertDepartmentsToMembers
        ? await resolveMembersFromSelection(selected, loadChildren, includeMembers)
        : selected;
      await onConfirm(confirmed);
      onOpenChange(false);
    } catch {
      // The caller owns error messaging. Keep the dialog open so the user can retry or adjust.
    } finally {
      setIsConfirming(false);
    }
  };

  const isBusy = isLoading || isSearching;
  const currentError = isSearchMode ? searchError : loadError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
      closeButtonTestId="organization-selector-dialog-close-button"
        className="flex h-[min(700px,calc(100vh-2rem))] flex-col overflow-hidden sm:max-w-3xl"
        data-testid={dialogContentTestId}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-background">
          <div className="space-y-4 border-b p-4">
            <FilterSearchInput
              clearLabel={t("organizationSelector.action.clearSearch")}
              onValueChange={setQuery}
              placeholder={searchPlaceholder}
              value={query}
              inputTestId={searchInputTestId}
              clearButtonTestId={clearSearchButtonTestId}
            />

            <div className="flex min-h-8 items-center gap-1 overflow-x-auto text-sm text-muted-foreground">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 px-2 text-muted-foreground"
                onClick={() => handleBreadcrumbClick(0)}
                data-testid={rootButtonTestId}
                disabled={!path.length}
              >
                {rootName ?? t("organizationSelector.root")}
              </Button>
              {path.map((item, index) => (
                <div key={getNodeKey(item)} className="flex shrink-0 items-center gap-1">
                  <ChevronRight className="size-4" aria-hidden="true" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    data-testid={breadcrumbButtonTestId}
                    onClick={() => handleBreadcrumbClick(index + 1)}
                  >
                    {item.name}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-2">
            {path.length && !isSearchMode ? (
              <Button
                variant="ghost"
                size="sm"
                className="mb-1 justify-start gap-2"
                data-testid={backButtonTestId}
                onClick={() => setPath((currentPath) => currentPath.slice(0, -1))}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                {t("organizationSelector.action.back")}
              </Button>
            ) : null}

            {isBusy ? (
              <SelectorState
                icon={<Loader2 className="size-4 animate-spin" />}
                label={t("organizationSelector.state.loading")}
                testId={loadingTestId}
              />
            ) : currentError ? (
              <SelectorState label={currentError} testId={errorTestId} />
            ) : visibleItems.length ? (
              <div className="space-y-1">
                {visibleItems.map((item) => (
                  <SelectorRow
                    key={getNodeKey(item)}
                    node={item}
                    selected={selectedMap.has(getNodeKey(item))}
                    selectable={isNodeSelectable(item, selectableTypes)}
                    onToggle={handleToggle}
                    onEnterDepartment={handleEnterDepartment}
                    rowTestId={rowTestId}
                    nodeButtonTestId={nodeButtonTestId}
                    checkboxTestId={checkboxTestId}
                    enterButtonTestId={enterButtonTestId}
                  />
                ))}
                {isSearchMode && searchHasMore ? (
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      data-testid={loadMoreButtonTestId}
                      disabled={isSearching}
                      onClick={handleLoadMore}
                    >
                      {isSearching ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : null}
                      {t("organizationSelector.action.loadMore")}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <SelectorState
                label={emptyLabel ?? t("organizationSelector.state.empty")}
                testId={emptyTestId}
              />
            )}
          </div>
        </section>

        <DialogFooter className="flex-row items-center justify-between gap-3 pt-0 sm:justify-between">
          <SelectionSummary
            convertDepartmentsToMembers={convertDepartmentsToMembers}
            selectedDepartments={selectedDepartments}
            selectedMembers={selectedMembers}
            total={selected.length}
          />
          <div className="flex flex-row gap-2 sm:justify-end">
            <Button
              data-testid={cancelButtonTestId}
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isConfirming}
            >
              {cancelLabel ?? t("organizationSelector.action.cancel")}
            </Button>
            <Button
              data-testid={confirmButtonTestId}
              onClick={handleConfirm}
              disabled={disabled || isConfirming}
            >
              {isConfirming ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {confirmLabel ?? t("organizationSelector.action.confirm")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

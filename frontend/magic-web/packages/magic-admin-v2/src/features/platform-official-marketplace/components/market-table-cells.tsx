import type { CSSProperties, ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Badge } from "@magic-admin-v2/components/ui/badge";
import { PortalThemeScope } from "@magic-admin-v2/components/ui/portal-theme-scope";
import {
  marketPublishStatus,
  marketPublisherType,
  type MarketPublisherType,
} from "@magic-admin-v2/features/platform-official-marketplace/types";
import {
  getPublishStatusLabel,
  getPublisherTypeLabel,
} from "@magic-admin-v2/features/platform-official-marketplace/utils";
import { useTranslation } from "react-i18next";
import { CopyableValue } from "@magic-admin-v2/components/copyable-value";
import { cn } from "@magic-admin-v2/utils/cn";

export function MarketCategoryBadges({ labels }: { labels: string[] }) {
  const { t } = useTranslation();

  if (!labels.length) {
    return (
      <span className="text-sm text-muted-foreground">
        {t("officialMarketplace.filter.uncategorized")}
      </span>
    );
  }

  const visibleLabels = labels.slice(0, 2);
  const hiddenCount = labels.length - visibleLabels.length;

  return (
    <div className="flex max-w-[220px] flex-wrap gap-1">
      {visibleLabels.map((label, index) => (
        <Badge className="max-w-36" key={`${label}-${index}`} variant="secondary">
          <span className="truncate">{label}</span>
        </Badge>
      ))}
      {hiddenCount > 0 ? <Badge variant="outline">+{hiddenCount}</Badge> : null}
    </div>
  );
}

export function MarketNameCell({
  fallbackIcon,
  imageUrl,
  name,
  secondaryCopyLabel,
  secondaryLabel,
  secondaryValue,
}: {
  fallbackIcon: ReactNode;
  imageUrl?: string;
  name: string;
  secondaryCopyLabel?: string;
  secondaryLabel?: string;
  secondaryValue?: string;
}) {
  return (
    <div className="flex h-10 min-w-0 items-center gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background text-muted-foreground">
        {imageUrl ? <img alt="" className="size-full object-cover" src={imageUrl} /> : fallbackIcon}
      </div>
      <div className="min-w-0">
        <div className="truncate font-medium text-foreground">{name}</div>
        {secondaryLabel ? (
          <CopyableValue
            className="max-w-full"
            copyLabel={secondaryCopyLabel}
            label={secondaryLabel}
            value={secondaryValue}
          />
        ) : null}
      </div>
    </div>
  );
}

export function OrganizationCell({ code, name }: { code?: string; name?: string }) {
  const { t } = useTranslation();

  return (
    <div className="flex h-10 min-w-0 flex-col justify-center">
      <div className="truncate text-sm text-foreground">{name || t("common.emptyValue")}</div>
      <CopyableValue
        className="max-w-full"
        label={t("officialMarketplace.column.organizationCode")}
        value={code}
      />
    </div>
  );
}

export function EmployeeRoleDescriptionCell({
  description,
  role,
}: {
  description: string;
  role: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid h-[4.75rem] min-w-0 content-center gap-1.5">
      <LabeledTooltipText
        label={t("officialMarketplace.column.role")}
        lineCount={1}
        value={role}
      />
      <LabeledTooltipText
        label={t("officialMarketplace.column.description")}
        lineCount={2}
        value={description}
      />
    </div>
  );
}

export function LabeledTooltipText({
  label,
  lineCount,
  value,
}: {
  label: string;
  lineCount: 1 | 2;
  value: string;
}) {
  const content = (
    <div className="flex min-w-0 items-start gap-2">
      <span className="mt-0.5 inline-flex h-5 shrink-0 items-center rounded border border-slate-200 bg-slate-50 px-1.5 text-[11px] font-medium leading-none text-slate-600">
        {label}
      </span>
      <span
        className={cn(
          "block max-w-[300px] whitespace-normal text-sm leading-5 text-muted-foreground",
          lineCount === 1 ? "line-clamp-1 h-5" : "line-clamp-2 h-10",
        )}
      >
        {value}
      </span>
    </div>
  );

  return value === "-" ? content : <HoverTooltip content={value}>{content}</HoverTooltip>;
}

export function DescriptionCell({ value }: { value: string }) {
  const content = (
    <span className="line-clamp-2 block h-10 max-w-[260px] whitespace-normal text-sm leading-5 text-muted-foreground">
      {value}
    </span>
  );

  return value === "-" ? content : <HoverTooltip content={value}>{content}</HoverTooltip>;
}

export function TableText({ value }: { value?: string }) {
  const { t } = useTranslation();

  return (
    <span className="flex h-10 max-w-[240px] items-center truncate text-sm text-muted-foreground">
      {value || t("common.emptyValue")}
    </span>
  );
}

/** Portal-based tooltip avoids clipping inside the horizontally scrolling table. */
export function HoverTooltip({
  children,
  content,
}: {
  children: ReactNode;
  content: string;
}) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({
    left: 0,
    top: 0,
    visibility: "hidden",
  });

  function clearCloseTimer() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function openTooltip() {
    clearCloseTimer();
    setIsOpen(true);
  }

  function closeTooltip() {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 120);
  }

  useLayoutEffect(() => {
    if (!isOpen) return;

    function updatePosition() {
      const trigger = triggerRef.current;
      const tooltip = tooltipRef.current;
      if (!trigger || !tooltip) return;

      const viewportPadding = 12;
      const gap = 8;
      const triggerRect = trigger.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const maxLeft = window.innerWidth - tooltipRect.width - viewportPadding;
      let left = triggerRect.left;
      let top = triggerRect.bottom + gap;

      left = Math.min(Math.max(left, viewportPadding), Math.max(viewportPadding, maxLeft));
      if (
        top + tooltipRect.height > window.innerHeight - viewportPadding &&
        triggerRect.top - gap - tooltipRect.height >= viewportPadding
      ) {
        top = triggerRect.top - gap - tooltipRect.height;
      }

      top = Math.min(
        Math.max(top, viewportPadding),
        Math.max(viewportPadding, window.innerHeight - tooltipRect.height - viewportPadding),
      );
      setStyle({ left, top });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  useEffect(
    () => () => {
      clearCloseTimer();
    },
    [],
  );

  return (
    <>
      <span
        ref={triggerRef}
        className="block max-w-full"
        onBlur={closeTooltip}
        onFocus={openTooltip}
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltip}
        tabIndex={0}
      >
        {children}
      </span>
      {isOpen
        ? createPortal(
            <PortalThemeScope>
              <div
                ref={tooltipRef}
                className="fixed z-[140] max-h-56 w-[min(420px,calc(100vw-1.5rem))] overflow-y-auto whitespace-pre-wrap rounded-md border bg-popover px-3 py-2 text-xs leading-5 text-popover-foreground shadow-md"
                onMouseEnter={openTooltip}
                onMouseLeave={closeTooltip}
                role="tooltip"
                style={style}
              >
                {content}
              </div>
            </PortalThemeScope>,
            document.body,
          )
        : null}
    </>
  );
}

export function PublishStatusBadge({ value }: { value?: string }) {
  const { t } = useTranslation();
  const variant =
    value === marketPublishStatus.published
      ? "success"
      : value === marketPublishStatus.publishing
        ? "info"
        : value === marketPublishStatus.offline
          ? "warning"
          : "outline";

  return <Badge variant={variant}>{getPublishStatusLabel(value, t)}</Badge>;
}

export function PublisherTypeBadge({ value }: { value?: MarketPublisherType }) {
  const { t } = useTranslation();
  const variant = value === marketPublisherType.user ? "outline" : "info";

  return <Badge variant={variant}>{getPublisherTypeLabel(value, t)}</Badge>;
}

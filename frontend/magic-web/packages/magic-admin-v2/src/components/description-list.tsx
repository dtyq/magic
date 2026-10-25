import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export type DescriptionListItem = readonly [label: string, value: ReactNode];

export type EditableDescriptionListItem = readonly [
  label: string,
  control: ReactNode,
  description?: string,
];

const descriptionListRowClassName = "grid gap-3 px-4 py-4 md:grid-cols-[200px_1fr]";

export function DescriptionList({ items }: { items: readonly DescriptionListItem[] }) {
  const { t } = useTranslation();

  return (
    <dl className="divide-y rounded-md border">
      {items.map(([label, value]) => (
        <div className={descriptionListRowClassName} key={label}>
          <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
          <dd className="min-w-0 whitespace-pre-wrap break-words text-sm text-foreground">
            {isEmptyDescriptionValue(value) ? (
              <span className="text-muted-foreground">{t("common.emptyValue")}</span>
            ) : (
              value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function EditableDescriptionList({
  items,
}: {
  items: readonly EditableDescriptionListItem[];
}) {
  return (
    <div className="divide-y rounded-md border">
      {items.map(([label, control, description]) => (
        <div className={`${descriptionListRowClassName} md:items-center`} key={label}>
          <div className="min-w-0">
            <div className="break-words text-sm font-medium text-foreground">{label}</div>
            {description ? (
              <div className="mt-1 break-words text-xs font-normal leading-5 text-muted-foreground">
                {description}
              </div>
            ) : null}
          </div>
          <div className="min-w-0">{control}</div>
        </div>
      ))}
    </div>
  );
}

function isEmptyDescriptionValue(value: ReactNode) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim().length === 0)
  );
}

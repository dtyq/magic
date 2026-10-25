import type { ReactNode } from "react";
import { X } from "lucide-react";
import { FilterSearchInput } from "@magic-admin-v2/components/filter-search-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@magic-admin-v2/components/ui/select";
import { cn } from "@magic-admin-v2/utils/cn";

export type FieldSearchOption<T extends string> = {
  value: T;
  label: string;
};

type FieldSearchControlProps<T extends string> = {
  ariaLabel: string;
  className?: string;
  clearLabel: string;
  clearButtonTestId?: string;
  contentTestId?: string;
  inputContent?: ReactNode;
  inputTestId?: string;
  inputValue: string;
  inputReadOnly?: boolean;
  onInputClear?: () => void;
  onInputClick?: () => void;
  onInputChange: (value: string) => void;
  onValueChange: (value: T) => void;
  options: Array<FieldSearchOption<T>>;
  placeholder: string;
  selectTriggerTestId?: string;
  optionTestId?: string;
  testId?: string;
  value: T;
};

export function FieldSearchControl<T extends string>({
  ariaLabel,
  className,
  clearButtonTestId,
  clearLabel,
  contentTestId,
  inputContent,
  inputTestId,
  inputValue,
  inputReadOnly = false,
  onInputClear,
  onInputClick,
  onInputChange,
  onValueChange,
  options,
  placeholder,
  selectTriggerTestId,
  optionTestId,
  testId,
  value,
}: FieldSearchControlProps<T>) {
  return (
    <div
      className={cn(
        "flex h-9 min-w-0 items-center rounded-md border border-input bg-card shadow-sm transition-colors focus-within:ring-2 focus-within:ring-ring",
        className,
      )}
      data-testid={testId}
    >
      <Select value={value} onValueChange={(nextValue) => onValueChange(nextValue as T)}>
        <SelectTrigger
          aria-label={ariaLabel}
          className="h-8 max-w-36 shrink-0 rounded-r-none border-0 bg-transparent px-3 shadow-none ring-offset-0 hover:bg-transparent focus:ring-0 focus:ring-offset-0 sm:max-w-44 [&>span]:truncate"
          data-testid={selectTriggerTestId}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          className="w-auto min-w-[220px] max-w-[min(280px,calc(100vw-2rem))]"
          data-testid={contentTestId ?? "field-search-control-filter-content"}
        >
          {options.map((option) => (
            <SelectItem
              className="whitespace-nowrap"
              data-testid={optionTestId}
              key={option.value}
              value={option.value}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="h-5 w-px shrink-0 bg-border" aria-hidden="true" />
      <div className="relative min-h-9 min-w-0 flex-1">
        {inputReadOnly ? (
          <>
            <FilterSearchInput
              aria-label={placeholder}
              className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0"
              clearButtonTestId={clearButtonTestId}
              clearLabel={clearLabel}
              containerClassName="w-full"
              inputTestId={inputTestId}
              onClick={onInputClick}
              onValueChange={() => undefined}
              placeholder={placeholder}
              readOnly
              value={inputValue}
            />
            {inputValue && onInputClear ? (
              <button
                aria-label={clearLabel}
                className="absolute right-1 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-testid={clearButtonTestId}
                onClick={onInputClear}
                type="button"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            ) : null}
          </>
        ) : (
          inputContent ?? (
            <FilterSearchInput
              aria-label={placeholder}
              className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0"
              clearButtonTestId={clearButtonTestId}
              clearLabel={clearLabel}
              containerClassName="w-full"
              inputTestId={inputTestId}
              onClick={onInputClick}
              onValueChange={onInputChange}
              placeholder={placeholder}
              value={inputValue}
            />
          )
        )}
        {inputReadOnly && inputContent ? (
          <div className="pointer-events-none absolute inset-0 h-full min-h-9 w-full">{inputContent}</div>
        ) : null}
      </div>
    </div>
  );
}

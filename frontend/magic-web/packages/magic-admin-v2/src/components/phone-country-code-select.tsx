import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@magic-admin-v2/components/ui/select";
import { getPhoneCountryCodeOptions } from "@magic-admin-v2/utils/phone";

export function PhoneCountryCodeSelect({
  ariaLabel,
  className = "w-28 shrink-0",
  disabled,
  onChange,
  value,
  optionTestId,
  triggerTestId,
}: {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  value?: string;
  optionTestId?: string;
  triggerTestId?: string;
}) {
  const currentValue = value?.trim() || "+86";
  const options = getPhoneCountryCodeOptions(currentValue);

  return (
    <Select disabled={disabled} onValueChange={onChange} value={currentValue}>
      <SelectTrigger aria-label={ariaLabel} className={className} data-testid={triggerTestId}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent data-testid="phone-country-code-select-filter-content">
        {options.map((option) => (
          <SelectItem data-testid={optionTestId} key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

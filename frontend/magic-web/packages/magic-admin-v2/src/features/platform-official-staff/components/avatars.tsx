import { Bot, Boxes } from "lucide-react";
import { EntityAvatarRender } from "@magic-admin-v2/components/entity-avatar-render";
import type {
  OfficialStaff,
  OfficialStaffModelOption,
  StaffModelItem,
} from "@magic-admin-v2/features/platform-official-staff/types";
import { getI18nText } from "@magic-admin-v2/features/platform-official-staff/utils/page-utils";

export function StaffAvatar({ item, size = "md" }: { item: OfficialStaff | StaffModelItem; size?: "sm" | "md" }) {
  const icon = "identifier" in item ? item.icon_url || item.icon : item.model_icon;
  const name = "identifier" in item ? getI18nText(item.name_i18n) : item.model_name;
  const isSmall = size === "sm";

  return (
    <EntityAvatarRender
      alt={name}
      className={isSmall ? "size-8" : "size-10"}
      fallbackIcon={<Bot className={isSmall ? "size-4" : "size-5"} aria-hidden="true" />}
      name={name}
      src={icon}
    />
  );
}

export function ModelAvatar({ item }: { item: StaffModelItem | OfficialStaffModelOption }) {
  const icon = "model_name" in item ? item.model_icon : item.icon;
  const name = "model_name" in item ? item.model_name : item.name || item.model_id;

  return (
    <EntityAvatarRender
      alt={name}
      className="size-6"
      fallbackIcon={<Boxes className="size-3.5" aria-hidden="true" />}
      name={name}
      src={icon}
    />
  );
}



import { Trash2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@magic-admin-v2/components/confirm-dialog";

export type DeleteConfirmDialogProps = {
  open: boolean;
  title: ReactNode;
  description: ReactNode;
  contentTestId?: string;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: ComponentProps<typeof ConfirmDialog>["onCloseAutoFocus"];
  onConfirm: () => void | Promise<void>;
  cancelLabel?: ReactNode;
  cancelButtonTestId?: string;
  confirmDisabled?: boolean;
  confirmIcon?: ReactNode;
  confirmLabel?: ReactNode;
  confirmButtonTestId?: string;
  isPending?: boolean;
};

export function DeleteConfirmDialog({
  open,
  title,
  description,
  contentTestId,
  onOpenChange,
  onCloseAutoFocus,
  onConfirm,
  cancelLabel,
  cancelButtonTestId,
  confirmDisabled = false,
  confirmIcon,
  confirmLabel,
  confirmButtonTestId,
  isPending = false,
}: DeleteConfirmDialogProps) {
  const { t } = useTranslation();

  return (
		<ConfirmDialog
			open={open}
			title={title}
			contentTestId={contentTestId}
			description={description}
			onOpenChange={onOpenChange}
			onCloseAutoFocus={onCloseAutoFocus}
			onConfirm={onConfirm}
			variant="danger"
			cancelLabel={cancelLabel}
			cancelButtonTestId={cancelButtonTestId}
			confirmDisabled={confirmDisabled}
			confirmIcon={confirmIcon ?? <Trash2 className="size-4" aria-hidden="true" />}
			confirmLabel={confirmLabel ?? t("common.delete")}
			confirmButtonTestId={confirmButtonTestId}
			isPending={isPending}
		/>
	);
}

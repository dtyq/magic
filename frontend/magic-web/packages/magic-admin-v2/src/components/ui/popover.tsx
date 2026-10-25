import * as React from "react";
import { createPortal } from "react-dom";
import { PortalThemeScope } from "@magic-admin-v2/components/ui/portal-theme-scope";
import { cn } from "@magic-admin-v2/utils/cn";

type PopoverContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
};

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

function Popover({
  children,
  className,
  onOpenChange,
  open: controlledOpen,
}: {
  children: React.ReactNode;
  className?: string;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const open = controlledOpen ?? uncontrolledOpen;

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (controlledOpen === undefined) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [controlledOpen, onOpenChange],
  );

  return (
    <PopoverContext.Provider value={{ open, setOpen, triggerRef }}>
      <div
        data-slot="popover"
        className={cn("relative w-full min-w-0 max-w-full", className)}
      >
        {children}
      </div>
    </PopoverContext.Provider>
  );
}

function PopoverTrigger({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const context = usePopoverContext();

  return (
    <button
      ref={context.triggerRef}
      type="button"
      aria-expanded={context.open}
      data-slot="popover-trigger"
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) {
          context.setOpen(!context.open);
        }
      }}
>
      {children}
    </button>
  );
}

function PopoverContent({
  align = "start",
  children,
  className,
  matchTriggerWidth = false,
  side = "auto",
}: {
  align?: "start" | "center" | "end";
  children: React.ReactNode;
  className?: string;
  matchTriggerWidth?: boolean;
  side?: "auto" | "top" | "bottom";
}) {
  const context = usePopoverContext();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [floatingStyle, setFloatingStyle] = React.useState<React.CSSProperties | null>(null);
  const containingBlock = context.triggerRef.current?.closest<HTMLElement>(
    '[data-slot="dialog-content"], [data-slot="sheet-content"]',
  );
  const isSheetContainingBlock = containingBlock?.dataset.slot === "sheet-content";
  const portalContainer = containingBlock ?? document.body;

  React.useEffect(() => {
    if (!context.open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        contentRef.current?.contains(target) ||
        context.triggerRef.current?.contains(target)
      ) {
        return;
      }
      context.setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        context.setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [context]);

  React.useLayoutEffect(() => {
    if (!context.open) {
      setFloatingStyle(null);
      return;
    }

    function updatePosition() {
      const trigger = context.triggerRef.current;
      const content = contentRef.current;

      if (!trigger || !content) {
        return;
      }

      const viewportPadding = 12;
      const gap = 8;
      const triggerRect = trigger.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const containingBlockRect = containingBlock?.getBoundingClientRect();
      const width = matchTriggerWidth ? triggerRect.width : contentRect.width;
      const height = contentRect.height;
      const maxLeft = window.innerWidth - width - viewportPadding;
      let left = triggerRect.left;

      if (align === "center") {
        left = triggerRect.left + (triggerRect.width - width) / 2;
      } else if (align === "end") {
        left = triggerRect.right - width;
      }

      left = Math.min(Math.max(left, viewportPadding), Math.max(viewportPadding, maxLeft));

      const belowTop = triggerRect.bottom + gap;
      let top = belowTop;

      if (side === "top") {
        top = triggerRect.top - gap - height;
      } else if (
        side === "auto" &&
        top + height > window.innerHeight - viewportPadding &&
        triggerRect.top - gap - height >= viewportPadding
      ) {
        top = triggerRect.top - gap - height;
      }

      if (side !== "bottom") {
        top = Math.min(
          Math.max(top, viewportPadding),
          Math.max(viewportPadding, window.innerHeight - height - viewportPadding),
        );
      }

      const maxHeight =
        side === "bottom"
          ? Math.max(0, window.innerHeight - belowTop - viewportPadding)
          : window.innerHeight - viewportPadding * 2;

      setFloatingStyle({
        left: left - (containingBlockRect?.left ?? 0),
        maxHeight: `${maxHeight}px`,
        maxWidth: `calc(100vw - ${viewportPadding * 2}px)`,
        top: top - (containingBlockRect?.top ?? 0),
        width: matchTriggerWidth ? `${width}px` : undefined,
      });
    }

    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [align, containingBlock, context.open, context.triggerRef, matchTriggerWidth, side]);

  if (!context.open) {
    return null;
  }

  const content = (
    <div
      ref={contentRef}
      data-slot="popover-content"
      onPointerDown={(event) => event.stopPropagation()}
      style={floatingStyle ?? { left: 0, top: 0, visibility: "hidden" }}
      className={cn(
        "pointer-events-auto z-[90] overflow-y-auto rounded-md border bg-popover p-3 text-popover-foreground shadow-md outline-none",
        isSheetContainingBlock ? "absolute" : "fixed",
        className,
      )}
    >
      {children}
    </div>
  );

  return createPortal(<PortalThemeScope>{content}</PortalThemeScope>, portalContainer);
}

function usePopoverContext() {
  const context = React.useContext(PopoverContext);

  if (!context) {
    throw new Error("Popover components must be used within Popover.");
  }

  return context;
}

export { Popover, PopoverContent, PopoverTrigger };

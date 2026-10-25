import type { HTMLAttributes, ReactNode } from "react";
import { useEffect, useState } from "react";
import { getAvatarFallbackText, shouldShowAvatarImage } from "@magic-admin-v2/components/ui/avatar-utils";
import { cn } from "@magic-admin-v2/utils/cn";

type AvatarProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  alt?: string;
  fallbackIcon?: ReactNode;
  fallbackImageSrc?: string | null;
  fallbackText?: string;
  imageClassName?: string;
  name?: string;
  src?: string | null;
};

export function Avatar({
  alt = "",
  className,
  fallbackIcon,
  fallbackImageSrc,
  fallbackText,
  imageClassName,
  name,
  src,
  ...props
}: AvatarProps) {
  const [hasImageError, setHasImageError] = useState(false);
  const [hasFallbackImageError, setHasFallbackImageError] = useState(false);
  const shouldShowImage = shouldShowAvatarImage(src, hasImageError);
  const shouldShowFallbackImage = !shouldShowImage && shouldShowAvatarImage(fallbackImageSrc, hasFallbackImageError);

  useEffect(() => {
    setHasImageError(false);
    setHasFallbackImageError(false);
  }, [fallbackImageSrc, src]);

  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-xs font-medium text-muted-foreground",
        className,
      )}
      {...props}
    >
      {shouldShowImage || shouldShowFallbackImage ? (
        <img
          alt={alt}
          className={cn("size-full object-cover", imageClassName)}
          draggable={false}
          onError={() => {
            if (shouldShowImage) {
              setHasImageError(true);
              return;
            }

            setHasFallbackImageError(true);
          }}
          src={shouldShowImage ? src ?? undefined : fallbackImageSrc ?? undefined}
        />
      ) : (
        fallbackIcon ?? getAvatarFallbackText(fallbackText ?? name)
      )}
    </span>
  );
}

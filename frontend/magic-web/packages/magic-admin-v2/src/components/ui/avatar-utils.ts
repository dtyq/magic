const emptyAvatarFallback = "?";

export function getAvatarFallbackText(value?: string | null) {
  const normalizedValue = value?.trim();

  if (!normalizedValue || normalizedValue === "-") {
    return emptyAvatarFallback;
  }

  return Array.from(normalizedValue)[0]?.toUpperCase() || emptyAvatarFallback;
}

export function isSafeAvatarImageUrl(value?: string | null) {
  if (!value) {
    return false;
  }

  return /^(https?:\/\/|data:image\/|blob:|\/)/i.test(value.trim());
}

export function shouldShowAvatarImage(value?: string | null, hasImageError = false) {
  return isSafeAvatarImageUrl(value) && !hasImageError;
}

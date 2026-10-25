import { Sparkles } from "lucide-react";

export function DefaultModelIcon() {
  return (
    <span className="flex size-full items-center justify-center rounded-full bg-gradient-to-br from-pink-300 via-fuchsia-400 to-violet-400">
      <Sparkles className="size-[58%] fill-white text-white" aria-hidden="true" />
    </span>
  );
}

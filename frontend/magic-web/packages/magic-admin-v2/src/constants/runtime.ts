export const RuntimeMode = {
  Embedded: "embedded",
  Standalone: "standalone",
} as const;

export type RuntimeMode = (typeof RuntimeMode)[keyof typeof RuntimeMode];

export const DEFAULT_CLUSTER_CODE = "global";

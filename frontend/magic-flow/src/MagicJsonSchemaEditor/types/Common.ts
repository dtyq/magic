// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Common {
  export type Options = Array<{
    label: string;
    value: string;
    children?: Options;
  }>;
}

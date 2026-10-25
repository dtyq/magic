import { RequestUrl } from "@magic-admin-v2/api/constants";

type PathParams = Record<string, string | number | null | undefined>;
type QueryParams = Record<
  string,
  string | number | boolean | null | undefined | Array<string | number | boolean>
>;

/** @deprecated Import RequestUrl from api/constants in new API factories. */
export const apiEndpoints = RequestUrl;

export function buildApiUrl(path: string, pathParams?: PathParams, queryParams?: QueryParams) {
  let url = path;

  Object.entries(pathParams ?? {}).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    url = url.replace(`:${key}`, encodeURIComponent(String(value)));
    url = url.replace(`\${${key}}`, encodeURIComponent(String(value)));
  });

  const search = new URLSearchParams();
  Object.entries(queryParams ?? {}).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((item) => search.append(`${key}[]`, String(item)));
      return;
    }
    search.set(key, String(value));
  });

  const query = search.toString();
  return query ? `${url}?${query}` : url;
}

import { Link, useLocation } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@magic-admin-v2/components/ui/breadcrumb";
import { useMemo } from "react";
import { useRouteConfig } from "@magic-admin-v2/routes/context";
import { createNavigation, getNavigationMatch } from "@magic-admin-v2/routes/menu";
import { useRuntime } from "@magic-admin-v2/runtime/context";
import { useTranslation } from "react-i18next";

export type AppBreadcrumbsProps = {
  fallbackLinkTestId?: string
  sectionLinkTestId?: string
}

export function AppBreadcrumbs({
  fallbackLinkTestId,
  sectionLinkTestId,
}: AppBreadcrumbsProps) {
  const location = useLocation();
  const { t } = useTranslation();
  const routes = useRouteConfig();
  const { access } = useRuntime();
  const navigation = useMemo(() => createNavigation(routes, access), [access, routes]);
  const match = getNavigationMatch(navigation, location.pathname);

  if (!match) {
    return (
      <Breadcrumb aria-label={t("aria.breadcrumb")}>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link data-testid={fallbackLinkTestId} to="/overview">{t("nav.item.overview")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t(getFallbackPageTitleKey(location.pathname))}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  return (
    <Breadcrumb aria-label={t("aria.breadcrumb")}>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link data-testid={sectionLinkTestId} to={match.section.href}>{t(match.section.titleKey)}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        {match.item ? (
          <>
            <BreadcrumbItem>
              <span>{t(match.group.titleKey)}</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t(match.item.titleKey)}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : (
          <BreadcrumbItem>
            <BreadcrumbPage>{t(match.group.titleKey)}</BreadcrumbPage>
          </BreadcrumbItem>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function getFallbackPageTitleKey(pathname: string): string {
  return pathname === "/403" ? "accessDenied.title" : "notFound.title";
}

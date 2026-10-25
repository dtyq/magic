<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use function Hyperf\Support\env;

$accountUsersOrganizationWhitelist = array_values(array_unique(array_filter(
    array_map(
        static fn (string $organizationCode): string => trim($organizationCode),
        explode(',', (string) env('ACCOUNT_ORGANIZATION_ACCESS_WHITELIST', ''))
    ),
    static fn (string $organizationCode): bool => $organizationCode !== ''
)));

return [
    // In APP_ENV=saas-pre, restrict account access to these organizations.
    // An empty list keeps the endpoint behavior unchanged.
    'account_users_organization_whitelist' => $accountUsersOrganizationWhitelist,
];

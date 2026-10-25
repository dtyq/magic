<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Gateway;

final class NullOrganizationAdminSync implements OrganizationAdminSyncInterface
{
    public function sync(string $organizationCode, string $userId, string $operation): void
    {
    }
}

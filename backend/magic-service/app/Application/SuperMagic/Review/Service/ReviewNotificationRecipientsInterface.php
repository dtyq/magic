<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Review\Service;

interface ReviewNotificationRecipientsInterface
{
    /** @return list<string> */
    public function resolve(string $organizationCode, string $resourceType, string $resourceCode, string $creator): array;
}

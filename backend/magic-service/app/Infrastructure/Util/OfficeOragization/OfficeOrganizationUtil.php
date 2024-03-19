<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\OfficeOragization;

class OfficeOrganizationUtil
{
    public static function getOfficeOrganizationCode(): string
    {
        return (string) config('service_provider.office_organization', '');
    }
}

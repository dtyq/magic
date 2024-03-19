<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\OrganizationEnvironment\Repository\Facade;

use App\Domain\Contact\Entity\ValueObject\PlatformType;

interface OrganizationsPlatformRepositoryInterface
{
    /**
     * 获取组织所属的(第三方)平台.
     * 麦吉支持从其他平台同步组织架构, 所以需要知道组织所属的平台.
     */
    public function getOrganizationPlatformType(string $magicOrganizationCode): PlatformType;
}

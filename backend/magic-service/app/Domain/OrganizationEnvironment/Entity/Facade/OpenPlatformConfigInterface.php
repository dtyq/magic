<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\OrganizationEnvironment\Entity\Facade;

/**
 * 开放平台的所有配置保存在数据库的一个字段中.
 */
interface OpenPlatformConfigInterface
{
    public function initObject(array $data): static;

    public function toArray(): array;
}

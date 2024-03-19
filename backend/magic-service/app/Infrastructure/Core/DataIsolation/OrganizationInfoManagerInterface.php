<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\DataIsolation;

use App\Infrastructure\Core\DataIsolation\ValueObject\OrganizationStatus;
use App\Infrastructure\Core\DataIsolation\ValueObject\OrganizationType;

interface OrganizationInfoManagerInterface
{
    /**
     * 获取组织ID.
     */
    public function getOrganizationId(): ?int;

    /**
     * 获取组织代码.
     */
    public function getOrganizationCode(): string;

    /**
     * 获取组织名称.
     */
    public function getOrganizationName(): string;

    /**
     * 获取组织类型.
     */
    public function getOrganizationType(): OrganizationType;

    /**
     * 获取组织状态.
     */
    public function getOrganizationStatus(): OrganizationStatus;

    /**
     * 设置组织ID.
     */
    public function setOrganizationId(?int $organizationId): void;

    /**
     * 设置组织代码.
     */
    public function setOrganizationCode(string $organizationCode): void;

    /**
     * 设置组织名称.
     */
    public function setOrganizationName(string $organizationName): void;

    /**
     * 设置组织类型.
     */
    public function setOrganizationType(OrganizationType $organizationType): void;

    /**
     * 设置组织状态.
     */
    public function setOrganizationStatus(OrganizationStatus $organizationStatus): void;

    /**
     * 转换为数组.
     */
    public function toArray(): array;
}

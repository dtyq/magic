<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Contract\Session;

use App\Domain\Contact\Entity\ValueObject\PlatformType;

interface LoginResponseInterface
{
    public function getMagicId(): string;

    public function setMagicId(string $magicId): self;

    public function getMagicUserId(): string;

    public function setMagicUserId(string $magicUserId): self;

    public function getMagicOrganizationCode(): string;

    public function setMagicOrganizationCode(string $magicOrganizationCode): self;

    public function getThirdPlatformOrganizationCode(): string;

    public function setThirdPlatformOrganizationCode(string $thirdPlatformOrganizationCode): self;

    public function getThirdPlatformUserId(): string;

    public function setThirdPlatformUserId(string $thirdPlatformUserId): self;

    public function getThirdPlatformType(): PlatformType;

    public function setThirdPlatformType(null|PlatformType|string $thirdPlatformType): self;

    /**
     * 转换为数组格式.
     *
     * @return array<string, mixed> 包含所有属性的数组
     */
    public function toArray(): array;
}

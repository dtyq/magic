<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Audit\Entity\ValueObject;

/**
 * 用户授权信息值对象.
 * Domain层定义，避免依赖Interfaces层.
 */
readonly class UserAuthorization
{
    public function __construct(
        private string $id,
        private string $organizationCode,
        private ?string $realName = null,
        private ?string $nickname = null
    ) {
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function getRealName(): ?string
    {
        return $this->realName;
    }

    public function getNickname(): ?string
    {
        return $this->nickname;
    }

    public function getDisplayName(): string
    {
        return $this->realName ?: $this->nickname ?: $this->id;
    }
}

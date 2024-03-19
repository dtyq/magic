<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Authentication\DTO;

use App\Infrastructure\Core\AbstractDTO;

class PersonalAccessTokenDTO extends AbstractDTO
{
    /**
     * 令牌（创建/重置时返回完整值，查询时返回脱敏值）.
     */
    protected string $token = '';

    /**
     * 创建时间.
     */
    protected string $createdAt = '';

    /**
     * 过期时间.
     */
    protected string $expiredAt = '';

    /**
     * 是否存在令牌.
     */
    protected bool $hasToken = false;

    public function getToken(): string
    {
        return $this->token;
    }

    public function setToken(string $token): void
    {
        $this->token = $token;
    }

    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getExpiredAt(): string
    {
        return $this->expiredAt;
    }

    public function setExpiredAt(string $expiredAt): void
    {
        $this->expiredAt = $expiredAt;
    }

    public function getHasToken(): bool
    {
        return $this->hasToken;
    }

    public function setHasToken(bool $hasToken): void
    {
        $this->hasToken = $hasToken;
    }
}

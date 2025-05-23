<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\DTO;

use App\Domain\Contact\Entity\AbstractEntity;

class UserUpdateDTO extends AbstractEntity
{
    /**
     * 用户头像URL.
     */
    protected ?string $avatarUrl = null;

    /**
     * 用户昵称.
     */
    protected ?string $nickname = null;

    public function getAvatarUrl(): ?string
    {
        return $this->avatarUrl;
    }

    public function setAvatarUrl(?string $avatarUrl): void
    {
        $this->avatarUrl = $avatarUrl;
    }

    public function getNickname(): ?string
    {
        return $this->nickname;
    }

    public function setNickname(?string $nickname): void
    {
        $this->nickname = $nickname;
    }

    /**
     * 转换为数组格式，过滤掉null值
     */
    public function toUpdateArray(): array
    {
        $data = [];

        if ($this->avatarUrl !== null) {
            $data['avatar_url'] = $this->avatarUrl;
        }

        if ($this->nickname !== null) {
            $data['nickname'] = $this->nickname;
        }

        return $data;
    }
}

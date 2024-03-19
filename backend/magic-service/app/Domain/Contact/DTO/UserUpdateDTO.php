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

    /**
     * 职业身份.
     */
    protected ?string $profession = null;

    /**
     * 获知渠道.
     */
    protected ?string $channel = null;

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

    public function getProfession(): ?string
    {
        return $this->profession;
    }

    public function setProfession(?string $profession): void
    {
        $this->profession = $profession;
    }

    public function getChannel(): ?string
    {
        return $this->channel;
    }

    public function setChannel(?string $channel): void
    {
        $this->channel = $channel;
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

        if ($this->profession !== null) {
            $data['profession'] = $this->profession;
        }

        if ($this->channel !== null) {
            $data['channel'] = $this->channel;
        }

        return $data;
    }
}

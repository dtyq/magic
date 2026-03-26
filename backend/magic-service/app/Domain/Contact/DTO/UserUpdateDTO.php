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
     * @var array<string, bool>
     */
    protected array $presentFields = [];

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

    /**
     * 用户所在时区(IANA).
     */
    protected ?string $timezone = null;

    public function getAvatarUrl(): ?string
    {
        return $this->avatarUrl;
    }

    public function setAvatarUrl(?string $avatarUrl): void
    {
        $this->markFieldPresent('avatar_url');
        $this->avatarUrl = $avatarUrl;
    }

    public function getNickname(): ?string
    {
        return $this->nickname;
    }

    public function setNickname(?string $nickname): void
    {
        $this->markFieldPresent('nickname');
        $this->nickname = $nickname;
    }

    public function getProfession(): ?string
    {
        return $this->profession;
    }

    public function setProfession(?string $profession): void
    {
        $this->markFieldPresent('profession');
        $this->profession = $profession;
    }

    public function getChannel(): ?string
    {
        return $this->channel;
    }

    public function setChannel(?string $channel): void
    {
        $this->markFieldPresent('channel');
        $this->channel = $channel;
    }

    public function getTimezone(): ?string
    {
        return $this->timezone;
    }

    public function setTimezone(?string $timezone): void
    {
        $this->markFieldPresent('timezone');
        $this->timezone = $timezone;
    }

    public function isFieldPresent(string $field): bool
    {
        return $this->presentFields[$field] ?? false;
    }

    /**
     * 转换为数组格式，过滤掉null值
     */
    public function toUpdateArray(): array
    {
        $data = [];

        if ($this->isFieldPresent('avatar_url')) {
            $data['avatar_url'] = $this->avatarUrl;
        }

        if ($this->isFieldPresent('nickname')) {
            $data['nickname'] = $this->nickname;
        }

        if ($this->isFieldPresent('profession')) {
            $data['profession'] = $this->profession;
        }

        if ($this->isFieldPresent('channel')) {
            $data['channel'] = $this->channel;
        }

        if ($this->isFieldPresent('timezone')) {
            $data['timezone'] = $this->timezone;
        }

        return $data;
    }

    private function markFieldPresent(string $field): void
    {
        $this->presentFields[$field] = true;
    }
}

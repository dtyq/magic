<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\ExecutionData;

class Operator
{
    public string $uid;

    public string $organizationCode;

    public string $nickname = '';

    public string $realName = '';

    public string $avatar = '';

    public string $magicId = '';

    public string $sourceId = '';

    public static function createByCrontab(string $organizationCode): Operator
    {
        $operator = new self();
        $operator->setUid('system');
        $operator->setOrganizationCode($organizationCode);
        $operator->setNickname('crontab');
        return $operator;
    }

    public function hasUid(): bool
    {
        return ! empty($this->uid);
    }

    public function getUid(): string
    {
        return $this->uid;
    }

    public function setUid(string $uid): void
    {
        $this->uid = $uid;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getNickname(): string
    {
        return $this->nickname;
    }

    public function setNickname(string $nickname): void
    {
        $this->nickname = $nickname;
    }

    public function getRealName(): string
    {
        return $this->realName;
    }

    public function setRealName(string $realName): void
    {
        $this->realName = $realName;
    }

    public function getAvatar(): string
    {
        return $this->avatar;
    }

    public function setAvatar(string $avatar): void
    {
        $this->avatar = $avatar;
    }

    public function getMagicId(): string
    {
        return $this->magicId;
    }

    public function setMagicId(string $magicId): void
    {
        $this->magicId = $magicId;
    }

    public function getSourceId(): string
    {
        return $this->sourceId;
    }

    public function setSourceId(string $sourceId): void
    {
        $this->sourceId = $sourceId;
    }
}

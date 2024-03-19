<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Agent\Service\ThirdPlatformChat;

class ThirdPlatformCreateGroup
{
    // 群名
    private string $name;

    // 群主的用户id
    private string $owner;

    // 成员列表
    private array $useridlist = [];

    // 新成员是否可查看历史消息：1（默认）：可查看，0：不可查看
    private int $showHistoryType = 1;

    // 是否可搜索群聊, 0（默认）：不可搜索 1：可搜索
    private int $searchable = 0;

    // 入群是否需要验证：0（默认）：不验证 1：入群验证
    private int $validationType = 0;

    // @all 使用范围： 0（默认）：所有人都可以@all
    private int $mentionAllAuthority = 0;

    // 群管理类型：0（默认）：所有人可管理，1：仅群主可管理
    private int $managementType = 0;

    // 是否开启群禁言：0（默认）：不禁言，1：全员禁言
    private int $chatBannedType = 0;

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setOwner(string $owner): void
    {
        $this->owner = $owner;
    }

    public function getOwner(): string
    {
        return $this->owner;
    }

    public function setUseridlist(array $useridlist): void
    {
        $this->useridlist = $useridlist;
    }

    public function getUseridlist(): array
    {
        return $this->useridlist;
    }

    public function setShowHistoryType(int $showHistoryType): void
    {
        $this->showHistoryType = $showHistoryType;
    }

    public function getShowHistoryType(): int
    {
        return $this->showHistoryType;
    }

    public function setSearchable(int $searchable): void
    {
        $this->searchable = $searchable;
    }

    public function getSearchable(): int
    {
        return $this->searchable;
    }

    public function setValidationType(int $validationType): void
    {
        $this->validationType = $validationType;
    }

    public function getValidationType(): int
    {
        return $this->validationType;
    }

    public function setMentionAllAuthority(int $mentionAllAuthority): void
    {
        $this->mentionAllAuthority = $mentionAllAuthority;
    }

    public function getMentionAllAuthority(): int
    {
        return $this->mentionAllAuthority;
    }

    public function setManagementType(int $managementType): void
    {
        $this->managementType = $managementType;
    }

    public function getManagementType(): int
    {
        return $this->managementType;
    }

    public function setChatBannedType(int $chatBannedType): void
    {
        $this->chatBannedType = $chatBannedType;
    }

    public function getChatBannedType(): int
    {
        return $this->chatBannedType;
    }
}

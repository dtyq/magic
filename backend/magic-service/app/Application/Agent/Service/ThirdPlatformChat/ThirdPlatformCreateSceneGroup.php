<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Agent\Service\ThirdPlatformChat;

class ThirdPlatformCreateSceneGroup
{
    // 群名
    private string $title;

    // 群所有者的用户id
    private string $ownerUserId;

    // 模板id
    private string $templateId;

    // 成员列表
    private array $userIds;

    // 管理员列表
    private array $subadminIds;

    // 新成员是否可查看历史消息
    private int $showHistoryType;

    // 是否可搜索群聊, 0（默认）：不可搜索 1 搜索
    private int $searchable = 0;

    // 入群是否需要验证：0（默认）：不验证 1：入群验证
    private int $validationType = 0;

    // @all 使用范围： 0（默认）：所有人都可以@all
    private int $mentionAllAuthority = 0;

    // 群管理类型：0（默认）：所有人可管理，1：仅群主可管理
    private int $managementType = 0;

    // 是否开启群禁言：0（默认）：不禁言，1：全员禁言
    private int $chatBannedType;

    // 群组唯一标识
    private string $uuid;

    public function setTitle(string $title): void
    {
        $this->title = $title;
    }

    public function getTitle(): string
    {
        return $this->title;
    }

    public function setOwnerUserId(string $ownerUserId): void
    {
        $this->ownerUserId = $ownerUserId;
    }

    public function getOwnerUserId(): string
    {
        return $this->ownerUserId;
    }

    public function setUserIds(array $userIds): void
    {
        $this->userIds = $userIds;
    }

    public function getUserIds(): array
    {
        return $this->userIds;
    }

    public function setSubadminIds(array $subadminIds): void
    {
        $this->subadminIds = $subadminIds;
    }

    public function getSubadminIds(): array
    {
        return $this->subadminIds;
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

    public function setUuid(string $uuid): void
    {
        $this->uuid = $uuid;
    }

    public function getUuid(): string
    {
        return $this->uuid;
    }

    public function setTemplateId(string $templateId): void
    {
        $this->templateId = $templateId;
    }

    public function getTemplateId(): string
    {
        return $this->templateId;
    }
}

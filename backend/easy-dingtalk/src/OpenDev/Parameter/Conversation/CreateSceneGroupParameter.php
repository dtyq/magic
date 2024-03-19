<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Parameter\Conversation;

use Dtyq\EasyDingTalk\Kernel\Exceptions\InvalidParameterException;
use Dtyq\EasyDingTalk\OpenDev\Parameter\AbstractParameter;

class CreateSceneGroupParameter extends AbstractParameter
{
    private string $title;

    private string $templateId;

    private string $ownerUserId;

    private string $userIds;

    private ?string $subadminIds = null;

    private string $uuid = '';

    private ?string $icon = null;

    private ?int $mentionAllAuthority = 0;

    private ?int $showHistoryType = 0;

    private ?int $validationType = 0;

    private ?int $searchable = 0;

    private ?int $chatBannedType = 0;

    private ?int $managementType = 0;

    private ?int $onlyAdminCanDing = 0;

    private ?int $allMembersCanCreateMcsConf = 1;

    private ?int $allMembersCanCreateCalendar = 0;

    private ?int $groupEmailDisabled = 0;

    private ?int $onlyAdminCanSetMsgTop = 0;

    private ?int $addFriendForbidden = 0;

    private ?int $groupLiveSwitch = 1;

    private ?int $membersToAdminChat = 0;

    public function getTitle(): string
    {
        return $this->title;
    }

    public function setTitle(string $title): self
    {
        $this->title = $title;
        return $this;
    }

    public function getTemplateId(): string
    {
        return $this->templateId;
    }

    public function setTemplateId(string $templateId): self
    {
        $this->templateId = $templateId;
        return $this;
    }

    public function getOwnerUserId(): string
    {
        return $this->ownerUserId;
    }

    public function setOwnerUserId(string $ownerUserId): self
    {
        $this->ownerUserId = $ownerUserId;
        return $this;
    }

    public function getUserIds(): ?string
    {
        return $this->userIds;
    }

    public function setUserIds(?string $userIds): self
    {
        $this->userIds = $userIds;
        return $this;
    }

    public function getSubadminIds(): ?string
    {
        return $this->subadminIds;
    }

    public function setSubadminIds(?string $subadminIds): self
    {
        $this->subadminIds = $subadminIds;
        return $this;
    }

    public function getUuid(): ?string
    {
        return $this->uuid;
    }

    public function setUuid(?string $uuid): self
    {
        $this->uuid = $uuid;
        return $this;
    }

    public function getIcon(): ?string
    {
        return $this->icon;
    }

    public function setIcon(?string $icon): self
    {
        $this->icon = $icon;
        return $this;
    }

    public function getMentionAllAuthority(): ?int
    {
        return $this->mentionAllAuthority;
    }

    public function setMentionAllAuthority(?int $mentionAllAuthority): self
    {
        $this->mentionAllAuthority = $mentionAllAuthority;
        return $this;
    }

    public function getShowHistoryType(): ?int
    {
        return $this->showHistoryType;
    }

    public function setShowHistoryType(?int $showHistoryType): self
    {
        $this->showHistoryType = $showHistoryType;
        return $this;
    }

    public function getValidationType(): ?int
    {
        return $this->validationType;
    }

    public function setValidationType(?int $validationType): self
    {
        $this->validationType = $validationType;
        return $this;
    }

    public function getSearchable(): ?int
    {
        return $this->searchable;
    }

    public function setSearchable(?int $searchable): self
    {
        $this->searchable = $searchable;
        return $this;
    }

    public function getChatBannedType(): ?int
    {
        return $this->chatBannedType;
    }

    public function setChatBannedType(?int $chatBannedType): self
    {
        $this->chatBannedType = $chatBannedType;
        return $this;
    }

    public function getManagementType(): ?int
    {
        return $this->managementType;
    }

    public function setManagementType(?int $managementType): self
    {
        $this->managementType = $managementType;
        return $this;
    }

    public function getOnlyAdminCanDing(): ?int
    {
        return $this->onlyAdminCanDing;
    }

    public function setOnlyAdminCanDing(?int $onlyAdminCanDing): self
    {
        $this->onlyAdminCanDing = $onlyAdminCanDing;
        return $this;
    }

    public function getAllMembersCanCreateMcsConf(): ?int
    {
        return $this->allMembersCanCreateMcsConf;
    }

    public function setAllMembersCanCreateMcsConf(?int $allMembersCanCreateMcsConf): self
    {
        $this->allMembersCanCreateMcsConf = $allMembersCanCreateMcsConf;
        return $this;
    }

    public function getAllMembersCanCreateCalendar(): ?int
    {
        return $this->allMembersCanCreateCalendar;
    }

    public function setAllMembersCanCreateCalendar(?int $allMembersCanCreateCalendar): self
    {
        $this->allMembersCanCreateCalendar = $allMembersCanCreateCalendar;
        return $this;
    }

    public function getGroupEmailDisabled(): ?int
    {
        return $this->groupEmailDisabled;
    }

    public function setGroupEmailDisabled(?int $groupEmailDisabled): self
    {
        $this->groupEmailDisabled = $groupEmailDisabled;
        return $this;
    }

    public function getOnlyAdminCanSetMsgTop(): ?int
    {
        return $this->onlyAdminCanSetMsgTop;
    }

    public function setOnlyAdminCanSetMsgTop(?int $onlyAdminCanSetMsgTop): self
    {
        $this->onlyAdminCanSetMsgTop = $onlyAdminCanSetMsgTop;
        return $this;
    }

    public function getAddFriendForbidden(): ?int
    {
        return $this->addFriendForbidden;
    }

    public function setAddFriendForbidden(?int $addFriendForbidden): self
    {
        $this->addFriendForbidden = $addFriendForbidden;
        return $this;
    }

    public function getGroupLiveSwitch(): ?int
    {
        return $this->groupLiveSwitch;
    }

    public function setGroupLiveSwitch(?int $groupLiveSwitch): self
    {
        $this->groupLiveSwitch = $groupLiveSwitch;
        return $this;
    }

    public function getMembersToAdminChat(): ?int
    {
        return $this->membersToAdminChat;
    }

    public function setMembersToAdminChat(?int $membersToAdminChat): self
    {
        $this->membersToAdminChat = $membersToAdminChat;
        return $this;
    }

    protected function validateParams(): void
    {
        if (empty($this->title)) {
            throw new InvalidParameterException('群名称不能为空');
        }
        if (empty($this->templateId)) {
            throw new InvalidParameterException('群模板ID不能为空');
        }
        if (empty($this->ownerUserId)) {
            throw new InvalidParameterException('群主ID不能为空');
        }
    }
}

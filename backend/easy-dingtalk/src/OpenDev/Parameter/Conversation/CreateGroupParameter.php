<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Parameter\Conversation;

use Dtyq\EasyDingTalk\Kernel\Exceptions\InvalidParameterException;
use Dtyq\EasyDingTalk\OpenDev\Parameter\AbstractParameter;

class CreateGroupParameter extends AbstractParameter
{
    private string $name;

    private string $owner;

    private array $useridlist = [];

    private ?int $showHistoryType = 1;

    private ?int $searchable = 0;

    private ?int $validationType = 0;

    private ?int $mentionAllAuthority = 0;

    private ?int $managementType = 0;

    private ?int $chatBannedType = 0;

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): self
    {
        $this->name = $name;
        return $this;
    }

    public function getOwner(): string
    {
        return $this->owner;
    }

    public function setOwner(string $owner): self
    {
        $this->owner = $owner;
        return $this;
    }

    public function getUseridlist(): array
    {
        return $this->useridlist;
    }

    public function setUseridlist(array $useridlist): self
    {
        $this->useridlist = $useridlist;
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

    public function getSearchable(): ?int
    {
        return $this->searchable;
    }

    public function setSearchable(?int $searchable): self
    {
        $this->searchable = $searchable;
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

    public function getMentionAllAuthority(): ?int
    {
        return $this->mentionAllAuthority;
    }

    public function setMentionAllAuthority(?int $mentionAllAuthority): self
    {
        $this->mentionAllAuthority = $mentionAllAuthority;
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

    public function getChatBannedType(): ?int
    {
        return $this->chatBannedType;
    }

    public function setChatBannedType(?int $chatBannedType): self
    {
        $this->chatBannedType = $chatBannedType;
        return $this;
    }

    /**
     * 验证参数.
     * @throws InvalidParameterException
     */
    protected function validateParams(): void
    {
        if (empty($this->name)) {
            throw new InvalidParameterException('群名称不能为空');
        }

        if (empty($this->owner)) {
            throw new InvalidParameterException('群主不能为空');
        }

        if (empty($this->useridlist)) {
            throw new InvalidParameterException('群成员不能为空');
        }
    }
}

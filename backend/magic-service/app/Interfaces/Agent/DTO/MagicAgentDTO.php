<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Agent\DTO;

use App\Infrastructure\Core\AbstractDTO;

class MagicAgentDTO extends AbstractDTO
{
    public string $id;

    /**
     * 指定版本id.
     */
    public ?string $agentVersionId = null;

    public ?string $botVersionId = null;

    // 交互指令
    public ?array $instruct = null;

    /**
     * 工作流 id.
     */
    public string $flowCode;

    /**
     * 助理名称.
     */
    public string $agentName;

    public string $robotName;

    /**
     * 助理头像.
     */
    public string $agentAvatar;

    public string $robotAvatar;

    /**
     * 助理描述.
     */
    public string $agentDescription;

    public string $robotDescription;

    /**
     * 发布人.
     */
    public string $createdUid;

    /**
     * 助理状态：启用｜禁用.
     */
    public ?int $status = null;

    /**
     * 创建时间.
     */
    public ?string $createdAt = null;

    /**
     * 更新者用户ID.
     */
    public ?string $updatedUid = '';

    /**
     * 更新时间.
     */
    public ?string $updatedAt = null;

    public ?array $agentVersion = null;

    public ?array $botVersion = null;

    public int $userOperation = 0;

    /**
     * 组织白名单（仅返回给管理端使用）。
     */
    public array $organizationWhitelist = [];

    public function getBotVersion(): ?array
    {
        return $this->botVersion;
    }

    public function setBotVersion(?array $botVersion): void
    {
        $this->botVersion = $botVersion;
    }

    public function getUserOperation(): int
    {
        return $this->userOperation;
    }

    public function setUserOperation(int $userOperation): void
    {
        $this->userOperation = $userOperation;
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(string $id): void
    {
        $this->id = $id;
    }

    public function getAgentVersionId(): ?string
    {
        return $this->agentVersionId;
    }

    public function setAgentVersionId(?string $agentVersionId): void
    {
        $this->agentVersionId = $agentVersionId;
        $this->botVersionId = $agentVersionId;
    }

    public function getInstruct(): ?array
    {
        return $this->instruct;
    }

    public function setInstruct(?array $instruct): void
    {
        $this->instruct = $instruct;
    }

    public function getFlowCode(): string
    {
        return $this->flowCode;
    }

    public function setFlowCode(string $flowCode): void
    {
        $this->flowCode = $flowCode;
    }

    public function getAgentName(): string
    {
        return $this->agentName;
    }

    public function setAgentName(string $agentName): void
    {
        $this->agentName = $agentName;
        $this->robotName = $agentName;
    }

    public function getAgentAvatar(): string
    {
        return $this->agentAvatar;
    }

    public function setAgentAvatar(string $agentAvatar): void
    {
        $this->agentAvatar = $agentAvatar;
        $this->robotAvatar = $agentAvatar;
    }

    public function getAgentDescription(): string
    {
        return $this->agentDescription;
    }

    public function setAgentDescription(string $agentDescription): void
    {
        $this->agentDescription = $agentDescription;
        $this->robotDescription = $agentDescription;
    }

    public function getCreatedUid(): string
    {
        return $this->createdUid;
    }

    public function setCreatedUid(string $createdUid): void
    {
        $this->createdUid = $createdUid;
    }

    public function getStatus(): ?int
    {
        return $this->status;
    }

    public function setStatus(?int $status): void
    {
        $this->status = $status;
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getUpdatedUid(): ?string
    {
        return $this->updatedUid;
    }

    public function setUpdatedUid(?string $updatedUid): void
    {
        $this->updatedUid = $updatedUid;
    }

    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?string $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    public function getAgentVersion(): ?array
    {
        return $this->agentVersion;
    }

    public function setAgentVersion(?array $agentVersion): void
    {
        $this->agentVersion = $agentVersion;
        $this->botVersion = $agentVersion;
    }

    public function getOrganizationWhitelist(): array
    {
        return $this->organizationWhitelist;
    }

    public function setOrganizationWhitelist(array $organizationWhitelist): void
    {
        $this->organizationWhitelist = $organizationWhitelist;
    }

    public function getBotVersionId(): ?string
    {
        return $this->botVersionId;
    }

    public function setBotVersionId(?string $botVersionId): void
    {
        $this->botVersionId = $botVersionId;
    }

    public function getRobotName(): string
    {
        return $this->robotName;
    }

    public function setRobotName(string $robotName): void
    {
        $this->robotName = $robotName;
    }

    public function getRobotAvatar(): string
    {
        return $this->robotAvatar;
    }

    public function setRobotAvatar(string $robotAvatar): void
    {
        $this->robotAvatar = $robotAvatar;
    }

    public function getRobotDescription(): string
    {
        return $this->robotDescription;
    }

    public function setRobotDescription(string $robotDescription): void
    {
        $this->robotDescription = $robotDescription;
    }
}

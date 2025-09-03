<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Entity;

use App\Domain\Agent\Constant\MagicAgentVersionStatus;
use Hyperf\Codec\Json;

class MagicAgentEntity extends AbstractEntity
{
    /**
     * 主键.
     */
    protected string $id;

    /**
     * 指定版本id.
     */
    protected ?string $agentVersionId = null;

    protected ?string $botVersionId = null;

    // 交互指令
    protected ?array $instructs = [];

    /**
     * 工作流 id.
     */
    protected string $flowCode;

    /**
     * 助理名称.
     */
    protected string $agentName = '';

    protected string $robotName;

    /**
     * 助理头像.
     */
    protected string $agentAvatar = '';

    protected string $robotAvatar;

    /**
     * 助理描述.
     */
    protected string $agentDescription = '';

    protected string $robotDescription;

    /**
     * 发布人.
     */
    protected string $createdUid;

    /**
     * 助理状态：启用｜禁用.
     */
    protected ?int $status = null;

    /**
     * 组织编码
     */
    protected string $organizationCode;

    /**
     * 创建时间.
     */
    protected ?string $createdAt = null;

    /**
     * 更新者用户ID.
     */
    protected ?string $updatedUid = '';

    /**
     * 更新时间.
     */
    protected ?string $updatedAt = null;

    /**
     * 删除时间.
     */
    protected ?string $deletedAt = null;

    protected ?array $lastVersionInfo = null;

    protected int $userOperation = 0;

    protected bool $startPage = false;

    public function isAvailable(): bool
    {
        return $this->status === MagicAgentVersionStatus::ENTERPRISE_ENABLED->value;
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

    public function setId(int|string $id): void
    {
        $this->id = (string) $id;
    }

    public function getAgentVersionId(): ?string
    {
        return $this->agentVersionId;
    }

    public function setAgentVersionId(null|int|string $agentVersionId): void
    {
        if (! is_null($agentVersionId)) {
            $this->agentVersionId = (string) $agentVersionId;
        }
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

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
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

    public function getDeletedAt(): ?string
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(?string $deletedAt): void
    {
        $this->deletedAt = $deletedAt;
    }

    public function getInstructs(): ?array
    {
        return $this->instructs;
    }

    public function setInstructs(null|array|string $instructs): void
    {
        if (is_string($instructs)) {
            $this->instructs = Json::decode($instructs);
        } elseif (is_array($instructs)) {
            $this->instructs = $instructs;
        }
    }

    public function getLastVersionInfo(): ?array
    {
        return $this->lastVersionInfo;
    }

    public function setLastVersionInfo(?array $lastVersionInfo): void
    {
        $this->lastVersionInfo = $lastVersionInfo;
    }

    public function setStartPage(bool|int $startPage): void
    {
        $this->startPage = (bool) $startPage;
    }

    public function getStartPage(): bool
    {
        return $this->startPage;
    }

    public function getBotVersionId(): ?string
    {
        return $this->botVersionId;
    }

    public function setBotVersionId(null|int|string $botVersionId): void
    {
        if (is_null($botVersionId)) {
            return;
        }
        $this->botVersionId = (string) $botVersionId;
        $this->agentVersionId = (string) $botVersionId;
    }

    public function getRobotName(): string
    {
        return $this->robotName;
    }

    public function setRobotName(string $robotName): void
    {
        $this->robotName = $robotName;
        $this->agentName = $robotName;
    }

    public function getRobotAvatar(): string
    {
        return $this->robotAvatar;
    }

    public function setRobotAvatar(string $robotAvatar): void
    {
        $this->robotAvatar = $robotAvatar;
        $this->agentAvatar = $robotAvatar;
    }

    public function getRobotDescription(): string
    {
        return $this->robotDescription;
    }

    public function setRobotDescription(string $robotDescription): void
    {
        $this->robotDescription = $robotDescription;
        $this->agentDescription = $robotDescription;
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Admin\Agent\DTO;

use App\Domain\Agent\Entity\ValueObject\Visibility\VisibilityConfig;
use App\Infrastructure\Core\AbstractDTO;
use App\Interfaces\Permission\DTO\ResourceAccessDTO;

class AdminAgentDetailDTO extends AbstractDTO
{
    // 主键
    protected string $id;

    // 助理名称
    protected string $agentName;

    // 助理描述
    protected string $agentDescription;

    // 助理创建人
    protected string $createdUid;

    // 助理头像
    protected string $agentAvatar;

    // 助理创建人昵称
    protected string $createdName;

    // 版本号，如果没有版本号则为：暂无版本
    protected string $versionNumber;

    // 启用状态
    protected int $status;

    // 创建时间
    protected string $createdAt;

    // 权限管控
    protected ResourceAccessDTO $resourceAccess;

    // 助理可见性
    protected ?VisibilityConfig $visibilityConfig;

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(string $id): void
    {
        $this->id = $id;
    }

    public function getAgentName(): string
    {
        return $this->agentName;
    }

    public function setAgentName(string $agentName): void
    {
        $this->agentName = $agentName;
    }

    public function getAgentDescription(): string
    {
        return $this->agentDescription;
    }

    public function setAgentDescription(string $agentDescription): void
    {
        $this->agentDescription = $agentDescription;
    }

    public function getCreatedUid(): string
    {
        return $this->createdUid;
    }

    public function setCreatedUid(string $createdUid): void
    {
        $this->createdUid = $createdUid;
    }

    public function getCreatedName(): string
    {
        return $this->createdName;
    }

    public function setCreatedName(string $createdName): void
    {
        $this->createdName = $createdName;
    }

    public function getVersionNumber(): string
    {
        return $this->versionNumber;
    }

    public function setVersionNumber(string $versionNumber): void
    {
        $this->versionNumber = $versionNumber;
    }

    public function getStatus(): int
    {
        return $this->status;
    }

    public function setStatus(int $status): void
    {
        $this->status = $status;
    }

    public function getResourceAccess(): ResourceAccessDTO
    {
        return $this->resourceAccess;
    }

    public function setResourceAccess(ResourceAccessDTO $resourceAccess): void
    {
        $this->resourceAccess = $resourceAccess;
    }

    public function getVisibilityConfig(): ?VisibilityConfig
    {
        return $this->visibilityConfig;
    }

    public function setVisibilityConfig(?VisibilityConfig $visibilityConfig): void
    {
        $this->visibilityConfig = $visibilityConfig;
    }

    public function getAgentAvatar(): string
    {
        return $this->agentAvatar;
    }

    public function setAgentAvatar(string $agentAvatar): void
    {
        $this->agentAvatar = $agentAvatar;
    }

    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }
}

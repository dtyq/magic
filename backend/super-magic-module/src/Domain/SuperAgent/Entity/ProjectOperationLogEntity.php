<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity;

use App\Infrastructure\Core\AbstractEntity;

/**
 * 项目操作日志实体.
 */
class ProjectOperationLogEntity extends AbstractEntity
{
    /**
     * @var int 主键ID
     */
    protected int $id = 0;

    /**
     * @var int 项目ID
     */
    protected int $projectId = 0;

    /**
     * @var string 用户ID
     */
    protected string $userId = '';

    /**
     * @var string 组织编码
     */
    protected string $organizationCode = '';

    /**
     * @var string 操作动作
     */
    protected string $operationAction = '';

    /**
     * @var string 资源类型
     */
    protected string $resourceType = '';

    /**
     * @var string 资源ID
     */
    protected string $resourceId = '';

    /**
     * @var string 资源名称
     */
    protected string $resourceName = '';

    /**
     * @var array 操作详情
     */
    protected array $operationDetails = [];

    /**
     * @var string 操作状态
     */
    protected string $operationStatus = 'success';

    /**
     * @var null|string IP地址
     */
    protected ?string $ipAddress = null;

    /**
     * @var string 创建时间
     */
    protected string $createdAt = '';

    /**
     * @var string 更新时间
     */
    protected string $updatedAt = '';

    public function getId(): int
    {
        return $this->id;
    }

    public function setId(int $id): self
    {
        $this->id = $id;
        return $this;
    }

    public function getProjectId(): int
    {
        return $this->projectId;
    }

    public function setProjectId(int $projectId): self
    {
        $this->projectId = $projectId;
        return $this;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): self
    {
        $this->userId = $userId;
        return $this;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): self
    {
        $this->organizationCode = $organizationCode;
        return $this;
    }

    public function getOperationAction(): string
    {
        return $this->operationAction;
    }

    public function setOperationAction(string $operationAction): self
    {
        $this->operationAction = $operationAction;
        return $this;
    }

    public function getResourceType(): string
    {
        return $this->resourceType;
    }

    public function setResourceType(string $resourceType): self
    {
        $this->resourceType = $resourceType;
        return $this;
    }

    public function getResourceId(): string
    {
        return $this->resourceId;
    }

    public function setResourceId(string $resourceId): self
    {
        $this->resourceId = $resourceId;
        return $this;
    }

    public function getResourceName(): string
    {
        return $this->resourceName;
    }

    public function setResourceName(string $resourceName): self
    {
        $this->resourceName = $resourceName;
        return $this;
    }

    public function getOperationDetails(): array
    {
        return $this->operationDetails;
    }

    public function setOperationDetails(array $operationDetails): self
    {
        $this->operationDetails = $operationDetails;
        return $this;
    }

    public function getOperationStatus(): string
    {
        return $this->operationStatus;
    }

    public function setOperationStatus(string $operationStatus): self
    {
        $this->operationStatus = $operationStatus;
        return $this;
    }

    public function getIpAddress(): ?string
    {
        return $this->ipAddress;
    }

    public function setIpAddress(?string $ipAddress): self
    {
        $this->ipAddress = $ipAddress;
        return $this;
    }

    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(string $createdAt): self
    {
        $this->createdAt = $createdAt;
        return $this;
    }

    public function getUpdatedAt(): string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(string $updatedAt): self
    {
        $this->updatedAt = $updatedAt;
        return $this;
    }
}

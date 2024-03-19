<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Share\Entity\ValueObject\Query;

use App\Infrastructure\Core\AbstractObject;

/**
 * 相似分享查询条件值对象.
 *
 * Domain 层使用的查询条件对象，用于封装查询相似分享的条件参数：
 * - projectId: 项目ID（用于项目分享查询）
 * - fileIds: 文件ID数组（用于文件集分享查询）
 * - resourceType: 资源类型（12 = Project，null = 文件查找模式）
 */
class SimilarQueryCondition extends AbstractObject
{
    /**
     * 项目ID.
     */
    protected string $projectId = '';

    /**
     * 文件ID数组.
     */
    protected array $fileIds = [];

    /**
     * 资源类型.
     * 12 = Project（项目分享）
     * null = 文件查找模式.
     */
    protected ?int $resourceType = null;

    /**
     * 获取项目ID.
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }

    /**
     * 设置项目ID.
     */
    public function setProjectId(string $projectId): self
    {
        $this->projectId = $projectId;
        return $this;
    }

    /**
     * 获取文件ID数组.
     */
    public function getFileIds(): array
    {
        return $this->fileIds;
    }

    /**
     * 设置文件ID数组.
     */
    public function setFileIds(array $fileIds): self
    {
        $this->fileIds = $fileIds;
        return $this;
    }

    /**
     * 获取资源类型.
     */
    public function getResourceType(): ?int
    {
        return $this->resourceType;
    }

    /**
     * 设置资源类型.
     */
    public function setResourceType(?int $resourceType): self
    {
        $this->resourceType = $resourceType;
        return $this;
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Share\Repository\ValueObject;

use Dtyq\SuperMagic\Domain\Share\Constant\ShareFilterType;

/**
 * 资源分享查询条件值对象.
 */
class ResourceShareQueryVO
{
    /**
     * 构造函数.
     *
     * @param null|string $createdUid 创建者用户ID
     * @param null|array<int>|int $resourceType 资源类型（支持单个或数组）
     * @param null|string $keyword 搜索关键词（用于特殊搜索逻辑）
     * @param null|int $projectId Project ID for filtering
     * @param null|bool $shareProject 是否分享整个项目
     * @param string $filterType 过滤类型（all=全部, active=分享中, expired=已失效, cancelled=已取消）
     */
    public function __construct(
        private ?string $createdUid = null,
        private null|array|int $resourceType = null,
        private ?string $keyword = null,
        private ?int $projectId = null,
        private ?bool $shareProject = null,
        private string $filterType = ShareFilterType::All->value,
    ) {
    }

    /**
     * 获取创建者用户ID.
     */
    public function getCreatedUid(): ?string
    {
        return $this->createdUid;
    }

    /**
     * 获取资源类型.
     * @return null|array<int>|int
     */
    public function getResourceType(): null|array|int
    {
        return $this->resourceType;
    }

    /**
     * 获取资源类型数组（统一返回数组格式）.
     * @return array<int>
     */
    public function getResourceTypes(): array
    {
        if ($this->resourceType === null) {
            return [];
        }
        return is_array($this->resourceType) ? $this->resourceType : [$this->resourceType];
    }

    /**
     * 判断资源类型是否为数组.
     */
    public function isResourceTypeArray(): bool
    {
        return is_array($this->resourceType);
    }

    /**
     * 获取搜索关键词.
     */
    public function getKeyword(): ?string
    {
        return $this->keyword;
    }

    /**
     * 判断是否有搜索关键词.
     */
    public function hasKeyword(): bool
    {
        return ! empty($this->keyword);
    }

    /**
     * Get project ID.
     */
    public function getProjectId(): ?int
    {
        return $this->projectId;
    }

    /**
     * 获取是否分享整个项目.
     */
    public function getShareProject(): ?bool
    {
        return $this->shareProject;
    }

    /**
     * 获取过滤类型.
     */
    public function getFilterType(): string
    {
        return $this->filterType;
    }

    /**
     * 从数组创建 VO.
     *
     * @param array $data 数据数组
     */
    public static function fromArray(array $data): self
    {
        // 处理 resource_type：支持单个整数或整数数组
        $resourceType = null;
        if (isset($data['resource_type'])) {
            if (is_array($data['resource_type'])) {
                $resourceType = array_map('intval', $data['resource_type']);
            } else {
                $resourceType = (int) $data['resource_type'];
            }
        }

        return new self(
            createdUid: $data['created_uid'] ?? null,
            resourceType: $resourceType,
            keyword: $data['keyword'] ?? null,
            projectId: isset($data['project_id']) ? (int) $data['project_id'] : null,
            shareProject: isset($data['share_project']) ? (bool) $data['share_project'] : null,
            filterType: $data['filter_type'] ?? ShareFilterType::All->value,
        );
    }
}

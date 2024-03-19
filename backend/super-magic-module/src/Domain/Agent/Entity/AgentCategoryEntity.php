<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity;

use App\Infrastructure\Core\AbstractEntity;

/**
 * Agent 分类实体.
 */
class AgentCategoryEntity extends AbstractEntity
{
    /**
     * @var int 主键 ID
     */
    protected ?int $id = null;

    /**
     * @var string 归属组织编码
     */
    protected string $organizationCode;

    /**
     * @var array 分类名称（多语言），格式：{"zh":"营销场景","en":"Marketing Scenes"}
     */
    protected array $nameI18n;

    /**
     * @var null|string Logo 图片 URL
     */
    protected ?string $logo = null;

    /**
     * @var int 排序权重，数值越大越靠前
     */
    protected int $sortOrder = 0;

    /**
     * @var string 创建者用户 ID
     */
    protected string $creatorId;

    /**
     * @var null|string 创建时间
     */
    protected ?string $createdAt = null;

    /**
     * @var null|string 更新时间
     */
    protected ?string $updatedAt = null;

    /**
     * @var null|string 软删除时间
     */
    protected ?string $deletedAt = null;

    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        $result = [
            'id' => $this->id,
            'organization_code' => $this->organizationCode,
            'name_i18n' => $this->nameI18n,
            'logo' => $this->logo,
            'sort_order' => $this->sortOrder,
            'creator_id' => $this->creatorId,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
            'deleted_at' => $this->deletedAt,
        ];

        return array_filter($result, function ($value) {
            return $value !== null;
        });
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(null|int|string $id): self
    {
        if (is_string($id)) {
            $this->id = (int) $id;
        } else {
            $this->id = $id;
        }
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

    public function getNameI18n(): array
    {
        return $this->nameI18n;
    }

    public function setNameI18n(array $nameI18n): self
    {
        $this->nameI18n = $nameI18n;
        return $this;
    }

    public function getLogo(): ?string
    {
        return $this->logo;
    }

    public function setLogo(?string $logo): self
    {
        $this->logo = $logo;
        return $this;
    }

    public function getSortOrder(): int
    {
        return $this->sortOrder;
    }

    public function setSortOrder(int|string $sortOrder): self
    {
        $this->sortOrder = is_string($sortOrder) ? (int) $sortOrder : $sortOrder;
        return $this;
    }

    public function getCreatorId(): string
    {
        return $this->creatorId;
    }

    public function setCreatorId(string $creatorId): self
    {
        $this->creatorId = $creatorId;
        return $this;
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?string $createdAt): self
    {
        $this->createdAt = $createdAt;
        return $this;
    }

    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?string $updatedAt): self
    {
        $this->updatedAt = $updatedAt;
        return $this;
    }

    public function getDeletedAt(): ?string
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(?string $deletedAt): self
    {
        $this->deletedAt = $deletedAt;
        return $this;
    }
}

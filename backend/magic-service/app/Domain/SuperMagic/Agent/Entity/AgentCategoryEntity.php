<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Agent\Entity;

use App\Domain\SuperMagic\Common\Entity\ResolvesI18nText;
use App\Infrastructure\Core\AbstractEntity;

/**
 * Agent 分类实体.
 */
class AgentCategoryEntity extends AbstractEntity
{
    use ResolvesI18nText;

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
     * @var int 状态：1-显示，0-隐藏
     */
    protected int $status = 1;

    /**
     * @var string 创建者用户 ID
     */
    protected string $creatorId;

    /**
     * @var null|string 最后更新者用户 ID
     */
    protected ?string $modifierId = null;

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
            'status' => $this->status,
            'creator_id' => $this->creatorId,
            'modifier_id' => $this->modifierId,
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

    public function getI18nName(string $language): string
    {
        return $this->resolveI18nText($this->nameI18n, $language);
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

    public function getStatus(): int
    {
        return $this->status;
    }

    public function setStatus(int|string $status): self
    {
        $this->status = is_string($status) ? (int) $status : $status;
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

    public function getModifierId(): ?string
    {
        return $this->modifierId;
    }

    public function setModifierId(?string $modifierId): self
    {
        $this->modifierId = $modifierId;
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

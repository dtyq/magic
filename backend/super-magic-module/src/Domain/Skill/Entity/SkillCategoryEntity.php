<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Entity;

use App\Infrastructure\Core\AbstractEntity;

/**
 * Skill 分类实体.
 */
class SkillCategoryEntity extends AbstractEntity
{
    /**
     * @var int 主键 ID
     */
    protected ?int $id = null;

    /**
     * @var array 分类名称（多语言）
     */
    protected array $nameI18n;

    /**
     * @var int 排序权重
     */
    protected int $sortOrder = 0;

    /**
     * @var null|string 创建时间
     */
    protected ?string $createdAt = null;

    /**
     * @var null|string 更新时间
     */
    protected ?string $updatedAt = null;

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
            'name_i18n' => $this->nameI18n,
            'sort_order' => $this->sortOrder,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
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

    public function getNameI18n(): array
    {
        return $this->nameI18n;
    }

    public function setNameI18n(array $nameI18n): self
    {
        $this->nameI18n = $nameI18n;
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
}

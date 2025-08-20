<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Entity\ValueObject\Query;

use App\Infrastructure\Core\AbstractQuery;

/**
 * 子管理员列表查询对象.
 *
 * 使用示例：
 * $query = new SubAdminQuery([
 *     'name' => '角色名称',
 *     'status' => 1,
 * ]);
 */
class SubAdminQuery extends AbstractQuery
{
    /** 子管理员名称（模糊匹配） */
    private ?string $name = null;

    /** 启用状态：1-启用 0-禁用 */
    private ?int $status = null;

    /**
     * 构造函数支持从数组批量初始化属性（继承自 AbstractObject）。
     */

    /* -------------------- getter / setter -------------------- */
    public function getName(): ?string
    {
        return $this->name;
    }

    public function setName(?string $name): self
    {
        $this->name = $name;
        return $this;
    }

    public function getStatus(): ?int
    {
        return $this->status;
    }

    public function setStatus(?int $status): self
    {
        $this->status = $status;
        return $this;
    }

    /**
     * 将查询对象转换为仓储层可识别的过滤数组。
     */
    public function toFilters(): array
    {
        $filters = [];
        if ($this->name !== null && $this->name !== '') {
            $filters['name'] = $this->name;
        }
        if ($this->status !== null) {
            $filters['status'] = $this->status;
        }
        return $filters;
    }
}

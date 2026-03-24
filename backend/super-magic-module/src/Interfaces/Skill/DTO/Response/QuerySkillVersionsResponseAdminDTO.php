<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

/**
 * 查询 Skill 版本列表响应 Admin DTO - 用于管理后台.
 */
class QuerySkillVersionsResponseAdminDTO extends AbstractDTO
{
    /**
     * @param SkillVersionListItemAdminDTO[] $list
     */
    public function __construct(
        private readonly array $list,
        private readonly int $page,
        private readonly int $pageSize,
        private readonly int $total,
    ) {
    }

    public function toArray(): array
    {
        return [
            'list' => array_map(static fn (SkillVersionListItemAdminDTO $item) => $item->toArray(), $this->list),
            'page' => $this->page,
            'page_size' => $this->pageSize,
            'total' => $this->total,
        ];
    }
}

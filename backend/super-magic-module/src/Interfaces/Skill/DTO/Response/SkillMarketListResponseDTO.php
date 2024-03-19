<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\DTO\Response;

use JsonSerializable;

/**
 * 市场技能列表响应 DTO.
 */
class SkillMarketListResponseDTO implements JsonSerializable
{
    /**
     * 技能列表项.
     *
     * @var SkillMarketListItemDTO[]
     */
    private array $list;

    /**
     * 当前页码.
     */
    private int $page;

    /**
     * 每页数量.
     */
    private int $pageSize;

    /**
     * 总记录数.
     */
    private int $total;

    /**
     * @param SkillMarketListItemDTO[] $list 技能列表
     * @param int $page 当前页码
     * @param int $pageSize 每页数量
     * @param int $total 总记录数
     */
    public function __construct(
        array $list,
        int $page,
        int $pageSize,
        int $total
    ) {
        $this->list = $list;
        $this->page = $page;
        $this->pageSize = $pageSize;
        $this->total = $total;
    }

    public function jsonSerialize(): array
    {
        return [
            'list' => array_map(fn ($item) => $item->jsonSerialize(), $this->list),
            'page' => $this->page,
            'page_size' => $this->pageSize,
            'total' => $this->total,
        ];
    }
}

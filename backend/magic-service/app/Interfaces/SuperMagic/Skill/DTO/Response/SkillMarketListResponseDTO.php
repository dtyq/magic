<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Skill\DTO\Response;

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
     * 总记录数（不需要时为空）.
     */
    private ?int $total;

    /**
     * @param SkillMarketListItemDTO[] $list 技能列表
     * @param int $page 当前页码
     * @param int $pageSize 每页数量
     * @param null|int $total 总记录数（不需要时传 null）
     */
    public function __construct(
        array $list,
        int $page,
        int $pageSize,
        ?int $total = null
    ) {
        $this->list = $list;
        $this->page = $page;
        $this->pageSize = $pageSize;
        $this->total = $total;
    }

    public function jsonSerialize(): array
    {
        $payload = [
            'list' => array_map(static fn ($item) => $item->jsonSerialize(), $this->list),
            'page' => $this->page,
            'page_size' => $this->pageSize,
        ];
        if ($this->total !== null) {
            $payload['total'] = $this->total;
        }

        return $payload;
    }
}

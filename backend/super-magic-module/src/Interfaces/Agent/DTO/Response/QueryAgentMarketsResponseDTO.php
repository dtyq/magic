<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

/**
 * 查询员工市场列表响应 DTO.
 */
class QueryAgentMarketsResponseDTO extends AbstractDTO
{
    /**
     * 员工列表.
     *
     * @var AgentMarketListItemDTO[]
     */
    private array $list;

    private int $page;

    private int $pageSize;

    private int $total;

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

    /**
     * 转换为数组（输出保持下划线命名，以保持API兼容性）.
     */
    public function toArray(): array
    {
        return [
            'list' => array_map(fn ($item) => $item->toArray(), $this->list),
            'page' => $this->page,
            'page_size' => $this->pageSize,
            'total' => $this->total,
        ];
    }
}

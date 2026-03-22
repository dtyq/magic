<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

/**
 * 管理后台：查询 Agent 市场列表响应 DTO.
 */
class QueryAgentMarketsResponseAdminDTO extends AbstractDTO
{
    /**
     * @param AgentMarketListItemAdminDTO[] $list
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
            'list' => array_map(static fn (AgentMarketListItemAdminDTO $item) => $item->toArray(), $this->list),
            'page' => $this->page,
            'page_size' => $this->pageSize,
            'total' => $this->total,
        ];
    }
}

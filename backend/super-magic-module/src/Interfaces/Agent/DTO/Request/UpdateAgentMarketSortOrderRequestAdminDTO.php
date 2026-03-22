<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

use function Hyperf\Translation\__;

/**
 * 更新 Agent 市场排序请求 DTO.
 */
class UpdateAgentMarketSortOrderRequestAdminDTO extends AbstractRequestDTO
{
    public int $sortOrder;

    public function getSortOrder(): int
    {
        return $this->sortOrder;
    }

    public function setSortOrder(int|string $value): void
    {
        $this->sortOrder = (int) $value;
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'sort_order' => 'required|integer',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [
            'sort_order.required' => __('validation.required', ['attribute' => 'sort_order']),
            'sort_order.integer' => __('validation.integer', ['attribute' => 'sort_order']),
        ];
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Agent\DTO\Request;

use App\Domain\SuperMagic\Agent\Entity\ValueObject\AgentMarketType;
use App\Infrastructure\Core\AbstractRequestDTO;

use function Hyperf\Translation\__;

/**
 * 查询员工市场列表请求 DTO.
 */
class QueryAgentMarketsRequestDTO extends AbstractRequestDTO
{
    /**
     * 页码，默认 1.
     */
    public int $page = 1;

    /**
     * 每页数量，默认 20，最大 100.
     */
    public int $pageSize = 20;

    /**
     * 关键词搜索，匹配 name_i18n、role_i18n 和 description_i18n 字段.
     */
    public string $keyword = '';

    /**
     * 分类筛选，对应 magic_super_magic_agent_categories.id，不传=全部.
     */
    /** @var null|array<int, null|int|string> */
    public ?array $categoryIds = null;

    /** 仅筛选公共市场或当前用户可见的组织内市场。 */
    public ?string $marketType = null;

    /**
     * 获取 Hyperf 验证规则.
     */
    public static function getHyperfValidationRules(): array
    {
        return [
            'page' => 'nullable|integer|min:1',
            'page_size' => 'nullable|integer|min:1|max:100',
            'keyword' => 'nullable|string|max:255',
            'category_ids' => 'nullable|array|max:100',
            'category_ids.*' => 'integer|min:1',
            'market_type' => 'nullable|string|in:MARKET,ORGANIZATION',
        ];
    }

    /**
     * 获取 Hyperf 验证消息.
     */
    public static function getHyperfValidationMessage(): array
    {
        return [
            'page.integer' => __('super_magic.agent.page_must_be_integer'),
            'page.min' => __('super_magic.agent.page_must_be_greater_than_zero'),
            'page_size.integer' => __('super_magic.agent.page_size_must_be_integer'),
            'page_size.min' => __('super_magic.agent.page_size_must_be_greater_than_zero'),
            'page_size.max' => __('super_magic.agent.page_size_must_not_exceed_100'),
            'keyword.string' => __('super_magic.agent.keyword_must_be_string'),
            'keyword.max' => __('super_magic.agent.keyword_must_not_exceed_255'),
        ];
    }

    public function getPage(): int
    {
        return $this->page;
    }

    public function getPageSize(): int
    {
        return $this->pageSize;
    }

    public function getKeyword(): string
    {
        return $this->keyword;
    }

    /** @return int[] */
    public function getCategoryIds(): array
    {
        if ($this->categoryIds !== null) {
            return $this->normalizeCategoryIds($this->categoryIds);
        }

        return [];
    }

    public function getMarketType(): ?AgentMarketType
    {
        return $this->marketType === null || $this->marketType === ''
            ? null
            : AgentMarketType::from($this->marketType);
    }

    /** @param array<int, null|int|string> $categoryIds */
    private function normalizeCategoryIds(array $categoryIds): array
    {
        $normalized = [];
        foreach ($categoryIds as $categoryId) {
            $categoryId = (int) $categoryId;
            if ($categoryId <= 0 || in_array($categoryId, $normalized, true)) {
                continue;
            }
            $normalized[] = $categoryId;
        }

        return $normalized;
    }
}

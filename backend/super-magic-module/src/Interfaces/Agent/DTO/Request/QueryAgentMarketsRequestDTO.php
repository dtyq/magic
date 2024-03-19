<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO\Request;

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
    public ?string $categoryId = null;

    /**
     * 获取 Hyperf 验证规则.
     */
    public static function getHyperfValidationRules(): array
    {
        return [
            'page' => 'nullable|integer|min:1',
            'page_size' => 'nullable|integer|min:1|max:100',
            'keyword' => 'nullable|string|max:255',
            'category_id' => 'nullable|string',
        ];
    }

    /**
     * 获取 Hyperf 验证消息.
     */
    public static function getHyperfValidationMessage(): array
    {
        return [
            'page.integer' => __('crew.page_must_be_integer'),
            'page.min' => __('crew.page_must_be_greater_than_zero'),
            'page_size.integer' => __('crew.page_size_must_be_integer'),
            'page_size.min' => __('crew.page_size_must_be_greater_than_zero'),
            'page_size.max' => __('crew.page_size_must_not_exceed_100'),
            'keyword.string' => __('crew.keyword_must_be_string'),
            'keyword.max' => __('crew.keyword_must_not_exceed_255'),
            'category_id.string' => __('crew.category_id_must_be_integer'),
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

    public function getCategoryId(): ?string
    {
        return $this->categoryId;
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Agent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

class QueryMagicClawListRequestDTO extends AbstractRequestDTO
{
    /**
     * Page number.
     */
    public int $page = 1;

    /**
     * Page size.
     */
    public int $pageSize = 10;

    public string $keyword = '';

    public function setKeyword(?string $keyword): void
    {
        $this->keyword = $keyword ?? '';
    }

    public function getKeyword(): string
    {
        return trim($this->keyword);
    }

    public function getPage(): int
    {
        return max(1, $this->page);
    }

    public function getPageSize(): int
    {
        return min(100, max(1, $this->pageSize));
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'page' => 'nullable|integer|min:1',
            'page_size' => 'nullable|integer|min:1|max:100',
            'keyword' => 'nullable|string',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [
            'page.integer' => 'Page must be an integer',
            'page.min' => 'Page must be at least 1',
            'page_size.integer' => 'Page size must be an integer',
            'page_size.min' => 'Page size must be at least 1',
            'page_size.max' => 'Page size cannot exceed 100',
        ];
    }
}

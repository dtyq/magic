<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Query message schedule logs request DTO.
 * Used to receive request parameters for querying message schedule execution logs.
 */
class QueryMessageScheduleLogsRequestDTO extends AbstractRequestDTO
{
    /**
     * Page number.
     */
    public int $page = 1;

    /**
     * Page size.
     */
    public int $pageSize = 10;

    public function getPage(): int
    {
        return $this->page;
    }

    public function getPageSize(): int
    {
        return $this->pageSize;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'page' => 'nullable|integer|min:1',
            'page_size' => 'nullable|integer|min:1|max:100',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'page.integer' => 'Page number must be an integer',
            'page.min' => 'Page number must be at least 1',
            'page_size.integer' => 'Page size must be an integer',
            'page_size.min' => 'Page size must be at least 1',
            'page_size.max' => 'Page size cannot exceed 100',
        ];
    }
}

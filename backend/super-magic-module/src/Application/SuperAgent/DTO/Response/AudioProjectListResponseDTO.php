<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\DTO\Response;

/**
 * Audio Project List Response DTO.
 */
class AudioProjectListResponseDTO
{
    private array $list;

    private int $total;

    private int $page;

    private int $pageSize;

    /**
     * Create from repository result.
     */
    public static function fromRepositoryResult(array $result): self
    {
        $dto = new self();
        $dto->list = self::transformListItems($result['list'] ?? []);
        $dto->total = $result['total'] ?? 0;
        $dto->page = $result['page'] ?? 1;
        $dto->pageSize = $result['page_size'] ?? 20;

        return $dto;
    }

    /**
     * Convert to array for API response.
     */
    public function toArray(): array
    {
        return [
            'list' => $this->list,
            'total' => $this->total,
            'page' => $this->page,
            'page_size' => $this->pageSize,
        ];
    }

    /**
     * Get list items.
     */
    public function getList(): array
    {
        return $this->list;
    }

    /**
     * Get total count.
     */
    public function getTotal(): int
    {
        return $this->total;
    }

    /**
     * Get page number.
     */
    public function getPage(): int
    {
        return $this->page;
    }

    /**
     * Get page size.
     */
    public function getPageSize(): int
    {
        return $this->pageSize;
    }

    /**
     * Transform list items: convert datetime to timestamp.
     */
    private static function transformListItems(array $items): array
    {
        return array_map(function ($item) {
            // Convert created_at to timestamp
            if (! empty($item['created_at'])) {
                $item['created_at'] = is_numeric($item['created_at'])
                    ? (int) $item['created_at']
                    : strtotime($item['created_at']);
            }

            // Convert updated_at to timestamp
            if (! empty($item['updated_at'])) {
                $item['updated_at'] = is_numeric($item['updated_at'])
                    ? (int) $item['updated_at']
                    : strtotime($item['updated_at']);
            }

            // Note: extra field is already properly constructed by AudioProjectExtraDTO in repository layer
            // No need to modify it here

            return $item;
        }, $items);
    }
}

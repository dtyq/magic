<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

/**
 * Batch delete projects response DTO.
 */
class BatchDeleteProjectsResponseDTO
{
    /**
     * @param BatchDeleteResultItemDTO[] $results
     */
    public function __construct(
        private readonly int $totalCount,
        private readonly int $successCount,
        private readonly int $failedCount,
        private readonly array $results
    ) {
    }

    public function toArray(): array
    {
        return [
            'total_count' => $this->totalCount,
            'success_count' => $this->successCount,
            'failed_count' => $this->failedCount,
            'results' => array_map(fn ($item) => $item->toArray(), $this->results),
        ];
    }
}

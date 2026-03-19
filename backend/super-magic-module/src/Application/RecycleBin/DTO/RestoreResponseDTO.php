<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\RecycleBin\DTO;

/**
 * 恢复资源响应 DTO.
 */
class RestoreResponseDTO
{
    private int $successCount = 0;

    private int $failedCount = 0;

    /**
     * @var RestoreResultItemDTO[]
     */
    private array $results = [];

    public function __construct(int $successCount, int $failedCount, array $results)
    {
        $this->successCount = $successCount;
        $this->failedCount = $failedCount;
        $this->results = $results;
    }

    public function toArray(): array
    {
        return [
            'success_count' => $this->successCount,
            'failed_count' => $this->failedCount,
            'results' => array_map(
                fn (RestoreResultItemDTO $item) => $item->toArray(),
                $this->results
            ),
        ];
    }
}

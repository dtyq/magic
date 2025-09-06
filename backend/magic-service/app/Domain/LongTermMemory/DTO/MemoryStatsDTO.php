<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\LongTermMemory\DTO;

use App\Infrastructure\Core\AbstractDTO;

/**
 * 记忆统计信息 DTO.
 */
class MemoryStatsDTO extends AbstractDTO
{
    public int $totalCount = 0;

    public array $typeCount = [];

    public int $totalSize = 0;

    public int $evictableCount = 0;

    public int $compressibleCount = 0;

    public int $averageSize = 0;

    public function __construct(?array $data = [])
    {
        parent::__construct($data);
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\LongTermMemory\DTO;

use App\Infrastructure\Core\AbstractDTO;
use DateTime;

/**
 * 更新记忆 DTO.
 */
class UpdateMemoryDTO extends AbstractDTO
{
    public ?string $content = null;

    public ?string $pendingContent = null;

    public ?string $explanation = null;

    public ?string $originText = null;

    public ?string $status = null;

    public ?bool $enabled = null;

    public ?float $confidence = null;

    public ?float $importance = null;

    public ?array $tags = null;

    public ?array $metadata = null;

    public ?DateTime $expiresAt = null;

    public function __construct(?array $data = [])
    {
        parent::__construct($data);
    }
}

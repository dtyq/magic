<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\LongTermMemory\DTO;

use App\Domain\LongTermMemory\Entity\ValueObject\MemoryStatus;
use App\Domain\LongTermMemory\Entity\ValueObject\MemoryType;
use App\Infrastructure\Core\AbstractDTO;
use DateTime;

/**
 * 创建记忆 DTO.
 */
class CreateMemoryDTO extends AbstractDTO
{
    public string $content = '';

    public ?string $pendingContent = null;

    public ?string $explanation = null;

    public ?string $originText = null;

    public MemoryType $memoryType = MemoryType::MANUAL_INPUT;

    public MemoryStatus $status = MemoryStatus::PENDING;

    public bool $enabled = false;

    public float $confidence = 0.8;

    public float $importance = 0.5;

    public array $tags = [];

    public array $metadata = [];

    public string $orgId = '';

    public string $appId = '';

    public ?string $projectId = null;

    public string $userId = '';

    public ?string $sourceMessageId = null;

    public ?DateTime $expiresAt = null;

    public function __construct(?array $data = [])
    {
        parent::__construct($data);
    }

    /**
     * 设置记忆类型.
     */
    public function setMemoryType(MemoryType|string $memoryType): void
    {
        if (is_string($memoryType)) {
            $this->memoryType = MemoryType::from($memoryType);
        } else {
            $this->memoryType = $memoryType;
        }
    }

    /**
     * 设置记忆状态.
     */
    public function setStatus(MemoryStatus|string $status): void
    {
        if (is_string($status)) {
            $this->status = MemoryStatus::from($status);
        } else {
            $this->status = $status;
        }
    }
}

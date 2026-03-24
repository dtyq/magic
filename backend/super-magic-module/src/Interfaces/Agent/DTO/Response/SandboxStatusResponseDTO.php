<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO\Response;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant\SandboxStatus;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\SandboxStatusResult;

class SandboxStatusResponseDTO
{
    // Frontend-facing status values
    public const STATUS_RUNNING = 'Running';

    public const STATUS_STARTING = 'Starting';

    public const STATUS_STOPPED = 'Stopped';

    public function __construct(
        private readonly string $sandboxId,
        private readonly string $status,
    ) {
    }

    public static function fromSandboxStatusResult(SandboxStatusResult $result): self
    {
        return new self(
            sandboxId: $result->getSandboxId() ?? '',
            status: self::mapStatus($result->getStatus() ?? ''),
        );
    }

    public function toArray(): array
    {
        return [
            'sandbox_id' => $this->sandboxId,
            'status' => $this->status,
        ];
    }

    /**
     * Map raw gateway status to frontend-facing status.
     *
     * Pending               → Starting
     * Running               → Running
     * Exited/Failed/etc.    → Stopped
     */
    private static function mapStatus(string $rawStatus): string
    {
        return match ($rawStatus) {
            SandboxStatus::PENDING => self::STATUS_STARTING,
            SandboxStatus::RUNNING => self::STATUS_RUNNING,
            default => self::STATUS_STOPPED,
        };
    }
}

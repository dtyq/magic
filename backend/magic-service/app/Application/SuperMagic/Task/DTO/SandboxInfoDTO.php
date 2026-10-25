<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Task\DTO;

final readonly class SandboxInfoDTO
{
    public function __construct(
        private string $sandboxId,
        private string $status,
        private string $currentVersion,
        private string $latestVersion,
        private ?bool $needsUpdate,
    ) {
    }

    public function getSandboxId(): string
    {
        return $this->sandboxId;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function getCurrentVersion(): string
    {
        return $this->currentVersion;
    }

    public function getLatestVersion(): string
    {
        return $this->latestVersion;
    }

    public function getNeedsUpdate(): ?bool
    {
        return $this->needsUpdate;
    }

    /**
     * @return array{sandbox_id: string, status: string, current_version: string, latest_version: string, needs_update: null|bool}
     */
    public function toArray(): array
    {
        return [
            'sandbox_id' => $this->sandboxId,
            'status' => $this->status,
            'current_version' => $this->currentVersion,
            'latest_version' => $this->latestVersion,
            'needs_update' => $this->needsUpdate,
        ];
    }
}

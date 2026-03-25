<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Kernel\DTO;

use App\Application\Bootstrap\ValueObject\BootstrapStatus;

class GlobalConfig
{
    private bool $isMaintenance = false;

    private string $maintenanceDescription = '';

    private string $bootstrapStatus = '';

    public function __construct()
    {
    }

    /**
     * 是否处于维护模式.
     */
    public function isMaintenance(): bool
    {
        return $this->isMaintenance;
    }

    public function setIsMaintenance(bool $isMaintenance): void
    {
        $this->isMaintenance = $isMaintenance;
    }

    public function getMaintenanceDescription(): string
    {
        return $this->maintenanceDescription;
    }

    public function setMaintenanceDescription(string $maintenanceDescription): void
    {
        $this->maintenanceDescription = $maintenanceDescription;
    }

    public function getBootstrapStatus(): string
    {
        return $this->bootstrapStatus;
    }

    public function setBootstrapStatus(string $bootstrapStatus): void
    {
        $this->bootstrapStatus = trim($bootstrapStatus);
    }

    public function toArray(): array
    {
        $bootstrapStatus = BootstrapStatus::tryFrom($this->bootstrapStatus);

        return [
            'is_maintenance' => $this->isMaintenance,
            'maintenance_description' => $this->maintenanceDescription,
            'need_initial' => $bootstrapStatus?->needInitial() ?? true,
            'bootstrap_status' => $this->bootstrapStatus,
        ];
    }

    public static function fromArray(array $data): self
    {
        $instance = new self();
        $instance->setIsMaintenance((bool) ($data['is_maintenance'] ?? false));
        $instance->setMaintenanceDescription((string) ($data['maintenance_description'] ?? ''));
        $instance->setBootstrapStatus((string) ($data['bootstrap_status'] ?? ''));
        return $instance;
    }
}

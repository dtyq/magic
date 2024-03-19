<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Kernel\DTO;

class GlobalConfig
{
    private bool $isMaintenance = false;

    private string $maintenanceDescription = '';

    private bool $needInitial = true;

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

    public function isNeedInitial(): bool
    {
        return $this->needInitial;
    }

    public function setNeedInitial(bool $needInitial): void
    {
        $this->needInitial = $needInitial;
    }

    public function toArray(): array
    {
        return [
            'is_maintenance' => $this->isMaintenance,
            'maintenance_description' => $this->maintenanceDescription,
            'need_initial' => $this->needInitial,
        ];
    }

    public static function fromArray(array $data): self
    {
        $instance = new self();
        $instance->setIsMaintenance((bool) ($data['is_maintenance'] ?? false));
        $instance->setMaintenanceDescription((string) ($data['maintenance_description'] ?? ''));
        $instance->setNeedInitial((bool) ($data['need_initial'] ?? true));
        return $instance;
    }
}

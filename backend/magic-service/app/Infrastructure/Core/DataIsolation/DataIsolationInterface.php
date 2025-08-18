<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\DataIsolation;

interface DataIsolationInterface
{
    public function getEnvironment(): string;

    public function getEnvId(): int;

    public function getOrganizationCodes(): array;

    public function getCurrentOrganizationCode(): string;

    public function getCurrentUserId(): string;

    public function getMagicId(): string;

    public function getThirdPlatformOrganizationCode(): string;

    public function getThirdPlatformUserId(): string;

    public function getThirdPlatformDataIsolationManager(): ThirdPlatformDataIsolationManagerInterface;

    public function isEnable(): bool;

    public function setEnabled(bool $enabled): static;

    public function setThirdPlatformUserId(string $thirdPlatformUserId): static;

    public function setThirdPlatformOrganizationCode(string $thirdPlatformOrganizationCode): static;

    public function setCurrentOrganizationCode(string $currentOrganizationCode): static;

    public function setCurrentUserId(string $currentUserId): static;

    public function setEnvId(int $envId): static;

    public function setMagicId(string $magicId): static;

    public function disabled(): static;

    public function extends(DataIsolationInterface $parentDataIsolation): void;

    public function isContainOfficialOrganization(): bool;

    public function setContainOfficialOrganization(bool $containOfficialOrganization): void;

    public function isOnlyOfficialOrganization(): bool;

    public function setOnlyOfficialOrganization(bool $onlyOfficialOrganization): void;

    public function getOfficialOrganizationCodes(): array;

    public function getOfficialOrganizationCode(): string;

    public function setOfficialOrganizationCodes(array $officialOrganizationCodes): void;

    public function isOfficialOrganization(): bool;

    public function getLanguage(): string;
}

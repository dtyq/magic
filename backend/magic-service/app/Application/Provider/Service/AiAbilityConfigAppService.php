<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\Service;

use App\Domain\Provider\Entity\AiAbilityEntity;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use InvalidArgumentException;
use RuntimeException;

readonly class AiAbilityConfigAppService
{
    public function __construct(
        private AiAbilityDomainService $aiAbilityDomainService,
    ) {
    }

    /**
     * @return array{enabled: bool, code: string, organization_code: string, config: array}
     */
    public function getConfig(string $organizationCode, string $abilityCode): array
    {
        $code = AiAbilityCode::tryFrom(trim($abilityCode));
        if ($code === null || $code === AiAbilityCode::Unknown) {
            throw new InvalidArgumentException('invalid ability_code');
        }

        $entity = $this->getOfficialAbilityEntity($code);
        if ($entity === null) {
            throw new RuntimeException('ai ability is not initialized');
        }

        return [
            'enabled' => $entity->isEnabled(),
            'code' => $entity->getCode()->value,
            'organization_code' => $entity->getOrganizationCode(),
            'config' => $entity->getConfig(),
        ];
    }

    private function getOfficialAbilityEntity(AiAbilityCode $code): ?AiAbilityEntity
    {
        $officialOrganizationCode = OfficialOrganizationUtil::getOfficialOrganizationCode();
        if ($officialOrganizationCode === '') {
            throw new RuntimeException('official organization code is empty');
        }

        $officialDataIsolation = ProviderDataIsolation::create($officialOrganizationCode);
        $officialDataIsolation->setOnlyOfficialOrganization(true);
        return $this->aiAbilityDomainService->getByCode($officialDataIsolation, $code);
    }
}

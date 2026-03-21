<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Service;

use Dtyq\SuperMagic\Domain\Agent\Entity\UserAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\UserAgentRepositoryInterface;

class UserAgentDomainService
{
    public function __construct(
        protected UserAgentRepositoryInterface $userAgentRepository
    ) {
    }

    public function saveUserAgentOwnership(SuperMagicAgentDataIsolation $dataIsolation, UserAgentEntity $entity): UserAgentEntity
    {
        return $this->userAgentRepository->save($dataIsolation, $entity);
    }

    public function findUserAgentOwnershipByCode(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode): ?UserAgentEntity
    {
        return $this->userAgentRepository->findByAgentCode($dataIsolation, $agentCode);
    }

    /**
     * @param array<string> $agentCodes
     * @return array<string, UserAgentEntity>
     */
    public function findUserAgentOwnershipsByCodes(SuperMagicAgentDataIsolation $dataIsolation, array $agentCodes): array
    {
        return $this->userAgentRepository->findByAgentCodes($dataIsolation, $agentCodes);
    }

    /**
     * @param array<string> $sourceTypes
     * @return array<string>
     */
    public function findAgentCodesBySourceTypes(SuperMagicAgentDataIsolation $dataIsolation, array $sourceTypes): array
    {
        return $this->userAgentRepository->findAgentCodesBySourceTypes($dataIsolation, $sourceTypes);
    }

    /**
     * @param array<int> $agentVersionIds
     * @return array<int, UserAgentEntity>
     */
    public function findUserAgentOwnershipsByVersionIds(SuperMagicAgentDataIsolation $dataIsolation, array $agentVersionIds): array
    {
        return $this->userAgentRepository->findByAgentVersionIds($dataIsolation, $agentVersionIds);
    }

    public function deleteUserAgentOwnership(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode): bool
    {
        return $this->userAgentRepository->deleteByAgentCode($dataIsolation, $agentCode);
    }

    public function deleteAllUserAgentOwnershipsByCode(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode): int
    {
        return $this->userAgentRepository->deleteAllByAgentCode($dataIsolation, $agentCode);
    }
}

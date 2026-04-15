<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Agent\Service;

use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\TargetType;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType as ResourceVisibilityResourceType;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;

class SuperMagicAgentAccessAppService extends AbstractSuperMagicAppService
{
    /**
     * @param array<string> $agentCodes
     * @return array{manageable_codes: array<string>, missing_codes: array<string>}
     */
    public function listManageableAgentCodes(string $organizationCode, string $userId, array $agentCodes): array
    {
        $agentCodes = $this->normalizeAgentCodes($agentCodes);
        if ($agentCodes === []) {
            return [
                'manageable_codes' => [],
                'missing_codes' => [],
            ];
        }

        $foundAgentCodes = $this->findExistingAgentCodes($organizationCode, $userId, $agentCodes);
        $manageableAgentCodes = [];
        if ($foundAgentCodes !== []) {
            $permissions = $this->operationPermissionDomainService->listByTargetIds(
                PermissionDataIsolation::create($organizationCode, $userId),
                ResourceType::CustomAgent,
                [$userId],
                $foundAgentCodes,
            );
            $manageableCodes = [];
            foreach ($permissions as $permission) {
                if (
                    $permission->getTargetType() !== TargetType::UserId
                    || $permission->getTargetId() !== $userId
                    || $permission->getOperation() !== Operation::Owner
                ) {
                    continue;
                }
                $manageableCodes[$permission->getResourceId()] = true;
            }

            foreach ($foundAgentCodes as $agentCode) {
                if (! isset($manageableCodes[$agentCode])) {
                    continue;
                }
                $manageableAgentCodes[] = $agentCode;
            }
            sort($manageableAgentCodes, SORT_STRING);
        }

        return [
            'manageable_codes' => $manageableAgentCodes,
            'missing_codes' => $this->collectMissingCodes($agentCodes, $foundAgentCodes),
        ];
    }

    /**
     * @param array<string> $agentCodes
     * @return array{accessible_codes: array<string>, missing_codes: array<string>}
     */
    public function listAccessibleAgentCodes(string $organizationCode, string $userId, array $agentCodes): array
    {
        $agentCodes = $this->normalizeAgentCodes($agentCodes);
        if ($agentCodes === []) {
            return [
                'accessible_codes' => [],
                'missing_codes' => [],
            ];
        }

        $foundAgentCodes = $this->findExistingAgentCodes($organizationCode, $userId, $agentCodes);
        $dataIsolation = SuperMagicAgentDataIsolation::create($organizationCode, $userId);
        $officialAgentCodes = array_values(array_intersect($agentCodes, $this->getOfficialAgentCodes($dataIsolation)));
        $visibleAgentCodes = $foundAgentCodes === []
            ? []
            : $this->resourceVisibilityDomainService->getUserAccessibleResourceCodes(
                $this->createPermissionDataIsolation($dataIsolation),
                $userId,
                ResourceVisibilityResourceType::SUPER_MAGIC_AGENT,
                $foundAgentCodes
            );
        $accessibleLookup = array_fill_keys(array_merge($officialAgentCodes, $visibleAgentCodes), true);

        $accessibleAgentCodes = [];
        foreach ($agentCodes as $agentCode) {
            if (! isset($accessibleLookup[$agentCode])) {
                continue;
            }
            $accessibleAgentCodes[] = $agentCode;
        }
        sort($accessibleAgentCodes, SORT_STRING);

        return [
            'accessible_codes' => $accessibleAgentCodes,
            'missing_codes' => $this->collectMissingCodes($agentCodes, array_values(array_unique(array_merge($foundAgentCodes, $officialAgentCodes)))),
        ];
    }

    /**
     * @param array<string> $agentCodes
     * @return array<string>
     */
    private function normalizeAgentCodes(array $agentCodes): array
    {
        return array_values(array_unique(array_filter(array_map(
            static fn (mixed $value): string => trim((string) $value),
            $agentCodes
        ))));
    }

    /**
     * @param array<string> $agentCodes
     * @return array<string>
     */
    private function findExistingAgentCodes(string $organizationCode, string $userId, array $agentCodes): array
    {
        $agentEntities = $this->superMagicAgentDomainService->findByCodes(
            SuperMagicAgentDataIsolation::create($organizationCode, $userId),
            $agentCodes
        );

        $foundAgentCodes = [];
        foreach ($agentEntities as $agentEntity) {
            $agentCode = trim($agentEntity->getCode());
            if ($agentCode === '') {
                continue;
            }
            $foundAgentCodes[] = $agentCode;
        }
        return $foundAgentCodes;
    }

    /**
     * @param array<string> $requestedCodes
     * @param array<string> $foundAgentCodes
     * @return array<string>
     */
    private function collectMissingCodes(array $requestedCodes, array $foundAgentCodes): array
    {
        $foundLookup = array_fill_keys($foundAgentCodes, true);
        $missingCodes = [];
        foreach ($requestedCodes as $agentCode) {
            if (isset($foundLookup[$agentCode])) {
                continue;
            }
            $missingCodes[] = $agentCode;
        }
        return $missingCodes;
    }
}

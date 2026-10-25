<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Agent\Service;

use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType as ResourceVisibilityResourceType;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\AgentSourceType;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use App\Domain\SuperMagic\Agent\Service\SuperMagicAgentVersionDomainService;
use Hyperf\Di\Annotation\Inject;

class SuperMagicAgentAccessAppService extends AbstractSuperMagicAppService
{
    #[Inject]
    protected SuperMagicAgentVersionDomainService $superMagicAgentVersionDomainService;

    /**
     * @param array<string> $agentCodes
     * @return array{usable_codes: array<string>, missing_codes: array<string>}
     */
    public function listUsableAgentCodes(string $organizationCode, string $userId, array $agentCodes): array
    {
        $agentCodes = $this->normalizeAgentCodes($agentCodes);
        if ($agentCodes === []) {
            return [
                'usable_codes' => [],
                'missing_codes' => [],
            ];
        }

        $foundAgentCodes = $this->findExistingAgentCodes($organizationCode, $userId, $agentCodes);
        $dataIsolation = SuperMagicAgentDataIsolation::create($organizationCode, $userId);
        $officialAgentCodes = array_values(array_intersect($agentCodes, $this->getOfficialAgentCodes($dataIsolation)));
        $ownerships = $this->userAgentDomainService->findUserAgentOwnershipsByCodes($dataIsolation, $agentCodes);
        $ownedAgentCodes = [];
        foreach ($ownerships as $agentCode => $ownership) {
            if (! in_array($ownership->getSourceType(), [AgentSourceType::LOCAL_CREATE, AgentSourceType::MARKET], true)) {
                continue;
            }
            $ownedAgentCodes[] = $agentCode;
        }
        $usableLookup = array_fill_keys(array_merge($ownedAgentCodes, $officialAgentCodes), true);

        $usableAgentCodes = [];
        foreach ($agentCodes as $agentCode) {
            if (isset($usableLookup[$agentCode])) {
                $usableAgentCodes[] = $agentCode;
            }
        }
        sort($usableAgentCodes, SORT_STRING);

        return [
            'usable_codes' => $usableAgentCodes,
            'missing_codes' => $this->collectMissingCodes(
                $agentCodes,
                array_values(array_unique(array_merge($foundAgentCodes, $ownedAgentCodes, $officialAgentCodes)))
            ),
        ];
    }

    /**
     * @return array{code: string, exists: bool, can_use: bool}
     */
    public function checkUsableAgentCode(string $organizationCode, string $userId, string $agentCode): array
    {
        $normalizedCode = $this->normalizeAgentCodes([$agentCode])[0] ?? '';
        if ($normalizedCode === '') {
            return [
                'code' => '',
                'exists' => false,
                'can_use' => false,
            ];
        }

        $result = $this->listUsableAgentCodes($organizationCode, $userId, [$normalizedCode]);
        $canUse = in_array($normalizedCode, $result['usable_codes'], true);
        $exists = ! in_array($normalizedCode, $result['missing_codes'], true);

        if (! $exists) {
            $market = $this->marketEligibilityDomainService->getPublishedByAgentCode($normalizedCode);
            if ($market !== null) {
                $exists = $this->marketEligibilityDomainService->isMarketDiscoverableForUser(
                    PermissionDataIsolation::create($organizationCode, $userId),
                    $market,
                    $userId
                );
            }
        }

        return [
            'code' => $normalizedCode,
            'exists' => $exists,
            'can_use' => $canUse,
        ];
    }

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
            $operations = $this->resourceAccessPolicyService->getReadableResourceOperations(
                SuperMagicAgentDataIsolation::create($organizationCode, $userId),
                ResourceType::CustomAgent,
                ResourceVisibilityResourceType::SUPER_MAGIC_AGENT,
                $foundAgentCodes,
            );
            $manageableCodes = [];
            foreach ($operations as $agentCode => $operation) {
                if (! $operation->canEdit()) {
                    continue;
                }
                $manageableCodes[$agentCode] = true;
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
     * @return array{
     *     accessible_codes: array<string>,
     *     missing_codes: array<string>,
     *     agent_organizations: array<string, string>
     * }
     */
    public function listAccessibleAgentCodes(string $organizationCode, string $userId, array $agentCodes): array
    {
        $agentCodes = $this->normalizeAgentCodes($agentCodes);
        if ($agentCodes === []) {
            return [
                'accessible_codes' => [],
                'missing_codes' => [],
                'agent_organizations' => [],
            ];
        }

        $foundAgentCodes = $this->findExistingAgentCodes($organizationCode, $userId, $agentCodes);
        $globalAgents = $this->superMagicAgentDomainService->findByCodesWithoutOrganizationFilter($agentCodes);
        $publicVersions = $this->superMagicAgentVersionDomainService
            ->getLatestPublishedByCodesWithoutOrganizationFilter($agentCodes);
        $dataIsolation = SuperMagicAgentDataIsolation::create($organizationCode, $userId);
        // 完整员工关联资源同时允许创建者、协作者、已雇佣用户和官方员工读取。
        $readableCodes = $this->getAccessibleAgentCodes($dataIsolation, $userId)['codes'];
        $usableCodes = $this->getUsableAgentCodes($dataIsolation)['codes'];
        $officialCodes = array_values(array_intersect($agentCodes, $this->getOfficialAgentCodes($dataIsolation)));
        $accessibleLookup = array_fill_keys(array_merge($readableCodes, $usableCodes), true);

        // 已发布的 ORGANIZATION / MARKET Agent 是公开资源，允许跨组织进入。
        foreach ($agentCodes as $agentCode) {
            if (! isset($globalAgents[$agentCode], $publicVersions[$agentCode])) {
                continue;
            }
            $accessibleLookup[$agentCode] = true;
        }

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
            'missing_codes' => $this->collectMissingCodes($agentCodes, array_merge($foundAgentCodes, $officialCodes)),
            'agent_organizations' => array_reduce(
                $accessibleAgentCodes,
                static function (array $result, string $agentCode) use ($globalAgents): array {
                    $organizationCode = ($globalAgents[$agentCode] ?? null)?->getOrganizationCode() ?? '';
                    if ($organizationCode !== '') {
                        $result[$agentCode] = $organizationCode;
                    }
                    return $result;
                },
                []
            ),
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

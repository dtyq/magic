<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Agent\Service;

use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType as ResourceVisibilityResourceType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityConfig;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityType;
use App\Domain\Permission\Service\ResourceVisibilityDomainService;
use App\Infrastructure\Util\File\EasyFileTools;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use DateTime;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentVersionEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\UserAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\AgentSourceType;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\PublisherType;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\PublishTargetType;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentType;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentDomainService;
use Dtyq\SuperMagic\Domain\Agent\Service\UserAgentDomainService;
use Hyperf\DbConnection\Db;
use Throwable;

class OfficialAgentsInitializer
{
    public function __construct(
        private readonly SuperMagicAgentDomainService $superMagicAgentDomainService,
        private readonly ResourceVisibilityDomainService $resourceVisibilityDomainService,
        private readonly UserAgentDomainService $userAgentDomainService,
    ) {
    }

    /**
     * @param array<string> $agentCodes
     * @return array{success: bool, message: string, success_count: int, skip_count: int, fail_count: int, results: array}
     */
    public function initialize(string $userId, array $agentCodes = []): array
    {
        $officialOrganizationCode = OfficialOrganizationUtil::getOfficialOrganizationCode();
        if (empty($officialOrganizationCode)) {
            return [
                'success' => false,
                'message' => 'Official organization code not configured in service_provider.office_organization',
                'success_count' => 0,
                'skip_count' => 0,
                'fail_count' => 0,
                'results' => [],
            ];
        }

        try {
            return [
                'success' => true,
                ...$this->initializeOfficialAgents($officialOrganizationCode, $userId, $agentCodes),
            ];
        } catch (Throwable $e) {
            return [
                'success' => false,
                'message' => 'Failed to create official agents: ' . $e->getMessage(),
                'success_count' => 0,
                'skip_count' => 0,
                'fail_count' => 0,
                'results' => [],
            ];
        }
    }

    /**
     * @param array<string> $agentCodes
     * @return array{success: bool, message: string, success_count: int, skip_count: int, fail_count: int, results: array}
     */
    public static function init(string $userId, array $agentCodes = []): array
    {
        return di(self::class)->initialize($userId, $agentCodes);
    }

    /**
     * @param array<string> $agentCodes
     * @return array{message: string, success_count: int, skip_count: int, fail_count: int, results: array<int, array<string, string>>}
     */
    private function initializeOfficialAgents(string $organizationCode, string $userId, array $agentCodes): array
    {
        $dataIsolation = SuperMagicAgentDataIsolation::create($organizationCode, $userId);
        $successCount = 0;
        $failCount = 0;
        $skipCount = 0;
        $results = [];

        foreach ($this->getOfficialAgentsConfig($agentCodes) as $config) {
            try {
                $existingAgent = $this->superMagicAgentDomainService->getByCode($dataIsolation, $config['code']);
                if ($existingAgent !== null) {
                    $results[] = [
                        'code' => $config['code'],
                        'status' => 'skipped',
                        'reason' => '已存在',
                    ];
                    ++$skipCount;
                    continue;
                }

                $entity = $this->createOfficialAgentEntity($config, $organizationCode, $userId);
                $entity = $this->superMagicAgentDomainService->saveDirectly($dataIsolation, $entity);

                $this->saveOfficialAgentVisibility($dataIsolation, $entity->getCode());
                $publishedVersion = $this->publishOfficialAgent($dataIsolation, $entity);
                $this->superMagicAgentDomainService->reviewAgentVersion(
                    $dataIsolation->disabled(),
                    (int) $publishedVersion->getId(),
                    'APPROVED',
                    $userId,
                    PublisherType::OFFICIAL_BUILTIN->value,
                    true,
                    isset($config['sort_order']) ? (int) $config['sort_order'] : null
                );
                $this->saveUserAgentOwnership(
                    $dataIsolation,
                    $entity->getCode(),
                    $entity->getSourceType(),
                    $entity->getSourceId(),
                    (int) $publishedVersion->getId()
                );

                $results[] = [
                    'code' => $config['code'],
                    'status' => 'success',
                    'agent_id' => (string) $entity->getId(),
                ];
                ++$successCount;
            } catch (Throwable $throwable) {
                $results[] = [
                    'code' => $config['code'],
                    'status' => 'failed',
                    'error' => $throwable->getMessage(),
                ];
                ++$failCount;
            }
        }

        return [
            'message' => "Created {$successCount} agents, skipped {$skipCount}, failed {$failCount}",
            'success_count' => $successCount,
            'skip_count' => $skipCount,
            'fail_count' => $failCount,
            'results' => $results,
        ];
    }

    /**
     * @param array<string> $agentCodes
     * @return array<int, array<string, mixed>>
     */
    private function getOfficialAgentsConfig(array $agentCodes): array
    {
        $officialAgentsConfig = config('official_agents', []);
        if ($agentCodes === []) {
            return $officialAgentsConfig;
        }

        $agentCodesSet = array_flip($agentCodes);

        return array_values(array_filter(
            $officialAgentsConfig,
            static fn (array $config) => isset($agentCodesSet[$config['code']])
        ));
    }

    /**
     * @param array<string, mixed> $config
     */
    private function createOfficialAgentEntity(array $config, string $organizationCode, string $userId): SuperMagicAgentEntity
    {
        $now = (new DateTime())->format('Y-m-d H:i:s');

        $entity = new SuperMagicAgentEntity();
        $entity->setCode($config['code']);
        $entity->setNameI18n($config['name_i18n']);
        $entity->setRoleI18n($config['role_i18n']);
        $entity->setDescriptionI18n($config['description_i18n']);
        $entity->setIcon([
            'type' => $config['icon'],
            'value' => $config['icon_url'],
            'color' => $config['color'],
        ]);
        $entity->setIconType(2);
        $entity->setName($config['name_i18n']['en_US'] ?? $config['name_i18n']['zh_CN'] ?? '');
        $entity->setDescription($config['description_i18n']['en_US'] ?? $config['description_i18n']['zh_CN'] ?? '');
        $entity->setOrganizationCode($organizationCode);
        $entity->setCreator($userId);
        $entity->setCreatedAt($now);
        $entity->setModifier($userId);
        $entity->setUpdatedAt($now);
        $entity->setEnabled(true);
        $entity->setType(SuperMagicAgentType::Custom);
        $entity->setSourceType(AgentSourceType::SYSTEM);
        $entity->setPrompt([
            'version' => '1.0.0',
            'structure' => [
                'type' => 'string',
                'string' => '',
            ],
        ]);

        $icon = $entity->getIcon();
        if (! empty($icon['value'])) {
            $icon['value'] = EasyFileTools::formatPath($icon['value']);
            $entity->setIcon($icon);
        }

        return $entity;
    }

    private function saveOfficialAgentVisibility(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode): void
    {
        $visibilityConfig = new VisibilityConfig();
        $visibilityConfig->setVisibilityType(VisibilityType::ALL);

        $this->resourceVisibilityDomainService->saveVisibilityConfig(
            $dataIsolation,
            ResourceVisibilityResourceType::SUPER_MAGIC_AGENT,
            $agentCode,
            $visibilityConfig
        );
    }

    private function publishOfficialAgent(
        SuperMagicAgentDataIsolation $dataIsolation,
        SuperMagicAgentEntity $agentEntity
    ): AgentVersionEntity {
        $versionEntity = new AgentVersionEntity();
        $versionEntity->setVersion('1.0.0');
        $versionEntity->setVersionDescriptionI18n([]);
        $versionEntity->setPublishTargetType(PublishTargetType::MARKET);
        $versionEntity->setPublishTargetValue(null);
        $agentEntity->setFileKey('');

        return Db::transaction(function () use ($dataIsolation, $agentEntity, $versionEntity) {
            return $this->superMagicAgentDomainService->publishAgent($dataIsolation, $agentEntity, $versionEntity);
        });
    }

    private function saveUserAgentOwnership(
        SuperMagicAgentDataIsolation $dataIsolation,
        string $agentCode,
        AgentSourceType $sourceType,
        ?int $sourceId = null,
        ?int $agentVersionId = null
    ): void {
        $entity = new UserAgentEntity([
            'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
            'user_id' => $dataIsolation->getCurrentUserId(),
            'agent_code' => $agentCode,
            'agent_version_id' => $agentVersionId,
            'source_type' => $sourceType->value,
            'source_id' => $sourceId,
        ]);

        $this->userAgentDomainService->saveUserAgentOwnership($dataIsolation, $entity);
    }
}

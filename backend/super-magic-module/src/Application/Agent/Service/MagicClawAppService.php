<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Agent\Service;

use App\Infrastructure\Util\File\EasyFileTools;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Dtyq\SuperMagic\Domain\Agent\Entity\MagicClawEntity;
use Dtyq\SuperMagic\Domain\Agent\Event\BeforeCreateClawEvent;
use Dtyq\SuperMagic\Domain\Agent\Service\MagicClawDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\SandboxVersionDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\CreateMagicClawRequestDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\UpdateMagicClawRequestDTO;
use Hyperf\Di\Annotation\Inject;
use Psr\EventDispatcher\EventDispatcherInterface;
use Qbhy\HyperfAuth\Authenticatable;
use Throwable;

class MagicClawAppService extends AbstractSuperMagicAppService
{
    #[Inject]
    protected MagicClawDomainService $magicClawDomainService;

    #[Inject]
    protected EventDispatcherInterface $eventDispatcher;

    #[Inject]
    protected ProjectDomainService $projectDomainService;

    #[Inject]
    protected TopicDomainService $topicDomainService;

    #[Inject]
    protected SandboxGatewayInterface $sandboxGateway;

    #[Inject]
    protected SandboxVersionDomainService $sandboxVersionDomainService;

    /**
     * Create a new magic claw record (does not bind project; that is done at the API layer).
     */
    public function create(Authenticatable $authorization, CreateMagicClawRequestDTO $dto): MagicClawEntity
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $userId = $dataIsolation->getCurrentUserId();
        $orgCode = $dataIsolation->getCurrentOrganizationCode();

        $this->eventDispatcher->dispatch(new BeforeCreateClawEvent(
            $orgCode,
            $userId,
            $dto->getName(),
            $dto->getDescription(),
            $dto->getIcon(),
            $dto->getTemplateCode()
        ));

        $entity = new MagicClawEntity();
        $entity->setName($dto->getName());
        $entity->setDescription($dto->getDescription());
        $entity->setIcon($dto->getIcon());
        $entity->setTemplateCode($dto->getTemplateCode());
        $entity->setOrganizationCode($orgCode);
        $entity->setUserId($userId);
        $entity->setCreatedUid($userId);
        $entity->setUpdatedUid($userId);

        $entity = $this->magicClawDomainService->createClaw($entity);
        $this->resolveIconUrl($orgCode, $entity);
        return $entity;
    }

    /**
     * Get magic claw detail with resolved icon URL.
     */
    public function show(Authenticatable $authorization, string $code): MagicClawEntity
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        $entity = $this->magicClawDomainService->findByCode(
            $code,
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode()
        );

        $this->resolveIconUrl($dataIsolation->getCurrentOrganizationCode(), $entity);
        return $entity;
    }

    /**
     * Update magic claw basic info and return updated entity with resolved icon URL.
     */
    public function update(Authenticatable $authorization, string $code, UpdateMagicClawRequestDTO $dto): MagicClawEntity
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $userId = $dataIsolation->getCurrentUserId();
        $orgCode = $dataIsolation->getCurrentOrganizationCode();

        $entity = $this->magicClawDomainService->updateClaw(
            $code,
            $userId,
            $orgCode,
            $dto->getName(),
            $dto->getDescription(),
            $dto->getIcon()
        );

        $this->resolveIconUrl($orgCode, $entity);
        return $entity;
    }

    /**
     * Delete a magic claw and stop its associated sandbox (if any).
     */
    public function delete(Authenticatable $authorization, string $code): void
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $userId = $dataIsolation->getCurrentUserId();
        $orgCode = $dataIsolation->getCurrentOrganizationCode();

        // Resolve sandbox_id before deletion: code → project_id → topic_id → sandbox_id
        $sandboxId = null;
        $entity = $this->magicClawDomainService->findByCode($code, $userId, $orgCode);
        $projectId = $entity->getProjectId();
        if ($projectId !== null) {
            $topicIdMap = $this->projectDomainService->getTopicIdMapByProjectIds([$projectId]);
            $topicId = $topicIdMap[$projectId] ?? null;
            if ($topicId !== null) {
                $topic = $this->topicDomainService->getTopicById($topicId);
                $sandboxId = $topic?->getSandboxId() ?: null;
            }
        }

        // Soft-delete MagicClaw record
        $this->magicClawDomainService->deleteClaw($code, $userId, $orgCode);

        // Stop sandbox after deletion (non-fatal: sandbox may already be gone)
        if (! empty($sandboxId)) {
            try {
                $result = $this->sandboxGateway->deleteSandbox($sandboxId);
                if (! $result->isSuccess()) {
                    $this->logger->warning('[MagicClaw] Failed to stop sandbox after deletion', [
                        'code' => $code,
                        'sandbox_id' => $sandboxId,
                        'message' => $result->getMessage(),
                    ]);
                }
            } catch (Throwable $e) {
                $this->logger->warning('[MagicClaw] Exception while stopping sandbox after deletion', [
                    'code' => $code,
                    'sandbox_id' => $sandboxId,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    /**
     * Get paginated magic claw list with resolved icon URLs and sandbox status.
     * Each item in list contains 'entity' (MagicClawEntity), 'status' (?string), 'topic_id' (?int), and 'need_upgrade' (bool).
     *
     * @return array{total: int, list: array<array{entity: MagicClawEntity, status: null|string, topic_id: null|int, need_upgrade: bool}>, page: int, page_size: int}
     */
    public function queries(Authenticatable $authorization, int $page, int $pageSize): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        $result = $this->magicClawDomainService->getList(
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode(),
            $page,
            $pageSize
        );

        $entities = $result['list'];
        $this->resolveIconUrls($dataIsolation->getCurrentOrganizationCode(), $entities);

        // Batch resolve projectId => topicId, then derive sandbox status from the same map
        $topicIdMap = $this->resolveTopicIdMap($entities);
        $statusByProjectId = $this->resolveSandboxStatusFromTopicIdMap($topicIdMap);
        $needUpgradeByTopicId = $this->resolveNeedUpgradeByTopicIdMap($topicIdMap);

        $list = array_map(function (MagicClawEntity $entity) use ($statusByProjectId, $topicIdMap, $needUpgradeByTopicId): array {
            $projectId = $entity->getProjectId();
            $topicId = $projectId !== null ? ($topicIdMap[$projectId] ?? null) : null;

            return [
                'entity' => $entity,
                'status' => $projectId !== null ? ($statusByProjectId[$projectId] ?? null) : null,
                'topic_id' => $topicId,
                'need_upgrade' => $topicId !== null ? ($needUpgradeByTopicId[$topicId] ?? false) : false,
            ];
        }, $entities);

        return [
            'total' => $result['total'],
            'list' => $list,
            'page' => $page,
            'page_size' => $pageSize,
        ];
    }

    /**
     * Bind a project to a magic claw record.
     */
    public function bindProject(Authenticatable $authorization, string $code, int $projectId): void
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $entity = $this->magicClawDomainService->findByCode(
            $code,
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode()
        );
        $this->magicClawDomainService->bindProject((int) $entity->getId(), $projectId);
    }

    /**
     * Batch-resolve projectId => currentTopicId for a list of claw entities.
     *
     * @param MagicClawEntity[] $entities
     * @return array<int, null|int> Map of projectId => topicId (null if none assigned)
     */
    private function resolveTopicIdMap(array $entities): array
    {
        $projectIds = array_values(array_filter(
            array_map(fn (MagicClawEntity $e) => $e->getProjectId(), $entities)
        ));

        if (empty($projectIds)) {
            return [];
        }

        return $this->projectDomainService->getTopicIdMapByProjectIds($projectIds);
    }

    /**
     * Batch-resolve sandbox running status indexed by project ID.
     * Accepts a pre-computed topicIdMap to avoid redundant DB queries.
     *
     * @param array<int, null|int> $topicIdMap Map of projectId => topicId
     * @return array<int, null|string> Map of projectId => sandbox status string (null if unavailable)
     */
    private function resolveSandboxStatusFromTopicIdMap(array $topicIdMap): array
    {
        if (empty($topicIdMap)) {
            return [];
        }

        // Collect non-null topic IDs as sandbox IDs
        $sandboxIds = array_values(array_map(
            'strval',
            array_filter(array_values($topicIdMap))
        ));

        if (empty($sandboxIds)) {
            return [];
        }

        // Batch query sandbox statuses in a single request
        $batchResult = $this->sandboxGateway->getBatchSandboxStatus($sandboxIds);

        // Build sandboxId => status lookup map
        $statusBySandboxId = [];
        foreach ($batchResult->getSandboxStatuses() as $item) {
            if (isset($item['sandbox_id'])) {
                $statusBySandboxId[$item['sandbox_id']] = $item['status'] ?? null;
            }
        }

        // Build final projectId => status map
        $result = [];
        foreach ($topicIdMap as $projectId => $topicId) {
            $result[$projectId] = $topicId !== null
                ? ($statusBySandboxId[(string) $topicId] ?? null)
                : null;
        }

        return $result;
    }

    /**
     * Batch-resolve sandbox version upgrade requirement indexed by topic ID.
     *
     * @param array<int, null|int> $topicIdMap Map of projectId => topicId
     * @return array<int, bool> Map of topicId => needUpgrade
     */
    private function resolveNeedUpgradeByTopicIdMap(array $topicIdMap): array
    {
        if (empty($topicIdMap)) {
            return [];
        }

        $topicIds = array_values(array_unique(array_filter(
            array_map(
                'intval',
                array_values($topicIdMap)
            ),
            static fn (int $topicId) => $topicId > 0
        )));
        if (empty($topicIds)) {
            return [];
        }

        try {
            return $this->sandboxVersionDomainService->checkNeedUpgradeByTopicIds($topicIds);
        } catch (Throwable $e) {
            $this->logger->warning('[MagicClaw] Failed to resolve need_upgrade in queries, fallback to false', [
                'topic_ids_count' => count($topicIds),
                'error' => $e->getMessage(),
            ]);
            return [];
        }
    }

    /**
     * Resolve icon file_key to a full URL for a single entity.
     */
    private function resolveIconUrl(string $orgCode, MagicClawEntity $entity): void
    {
        $fileKey = $entity->getIcon();
        if (empty($fileKey)) {
            return;
        }

        $path = EasyFileTools::formatPath($fileKey);
        $links = $this->getIcons($orgCode, [$path]);
        $fileLink = $links[$path] ?? null;
        $entity->setIconFileUrl($fileLink instanceof FileLink ? $fileLink->getUrl() : '');
    }

    /**
     * Batch-resolve icon file_keys to full URLs for a list of entities.
     *
     * @param MagicClawEntity[] $entities
     */
    private function resolveIconUrls(string $orgCode, array $entities): void
    {
        if (empty($entities)) {
            return;
        }

        $paths = [];
        foreach ($entities as $entity) {
            if ($entity->getIcon() !== '') {
                $paths[] = EasyFileTools::formatPath($entity->getIcon());
            }
        }

        if (empty($paths)) {
            return;
        }

        $links = $this->getIcons($orgCode, array_values(array_unique($paths)));

        foreach ($entities as $entity) {
            if ($entity->getIcon() === '') {
                continue;
            }
            $path = EasyFileTools::formatPath($entity->getIcon());
            $fileLink = $links[$path] ?? null;
            $entity->setIconFileUrl($fileLink instanceof FileLink ? $fileLink->getUrl() : '');
        }
    }
}

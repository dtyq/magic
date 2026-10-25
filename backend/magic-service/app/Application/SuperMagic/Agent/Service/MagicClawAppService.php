<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Agent\Service;

use App\Domain\SuperMagic\Agent\Entity\MagicClawEntity;
use App\Domain\SuperMagic\Agent\Event\BeforeCreateClawEvent;
use App\Domain\SuperMagic\Agent\Service\MagicClawDomainService;
use App\Domain\SuperMagic\Agent\Service\MagicClawRuntimePolicyDomainService;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Task\Service\SandboxVersionDomainService;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use App\Infrastructure\Util\File\EasyFileTools;
use App\Interfaces\SuperMagic\Agent\DTO\Request\CreateMagicClawRequestDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Request\UpdateMagicClawRequestDTO;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
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
        di(MagicClawRuntimePolicyDomainService::class)->assertCanCreate($orgCode, $userId);

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

        // Deletion uses the same durable cleanup as revocation, including every topic and converter.
        $this->magicClawDomainService->deleteClaw($code, $userId, $orgCode);
        di(MagicClawReconciliationAppService::class)->requestReconciliation($orgCode, 'claw_deleted', true);
    }

    /**
     * Get paginated magic claw list with resolved icon URLs and sandbox status.
     * Each item in list contains 'entity' (MagicClawEntity), 'status' (?string), 'topic_id' (?int), and 'need_upgrade' (bool|null).
     *
     * @return array{total: int, list: array<array{entity: MagicClawEntity, status: null|string, topic_id: null|int, need_upgrade: null|bool}>, page: int, page_size: int}
     */
    public function queries(Authenticatable $authorization, int $page, int $pageSize, string $keyword = ''): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        $result = $this->magicClawDomainService->getList(
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode(),
            $page,
            $pageSize,
            $keyword
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
                'need_upgrade' => $topicId !== null ? ($needUpgradeByTopicId[$topicId] ?? null) : null,
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
     * Accepts a pre-computed topicIdMap to avoid redundant DB queries. The
     * topic's real sandbox_id is resolved off the topic before querying the
     * gateway, since warm-pool sandboxes do not use the topic id as sandbox id.
     *
     * @param array<int, null|int> $topicIdMap Map of projectId => topicId
     * @return array<int, null|string> Map of projectId => sandbox status string (null if unavailable)
     */
    private function resolveSandboxStatusFromTopicIdMap(array $topicIdMap): array
    {
        if (empty($topicIdMap)) {
            return [];
        }

        // Resolve each topic's REAL sandbox_id. The sandbox id is NOT always
        // equal to the topic id: warm-pool (预热) sandboxes are created with a
        // pool-generated id that is later bound onto the topic's sandbox_id
        // field. Querying the gateway with the topic id would miss those pods
        // and report `NotFound` even though they are running in k8s. So we must
        // look the real sandbox_id up off the topic before querying status.
        $topicIds = array_values(array_unique(array_filter(
            array_map('intval', array_values($topicIdMap)),
            static fn (int $topicId) => $topicId > 0
        )));

        if (empty($topicIds)) {
            return [];
        }

        // Build topicId => real sandbox_id map.
        $sandboxIdByTopicId = [];
        foreach ($this->topicDomainService->getTopicsByIds($topicIds) as $topic) {
            $sandboxId = (string) $topic->getSandboxId();
            if ($sandboxId !== '') {
                $sandboxIdByTopicId[(int) $topic->getId()] = $sandboxId;
            }
        }

        $sandboxIds = array_values(array_unique($sandboxIdByTopicId));
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

        // Build final projectId => status map, going through the real sandbox_id.
        $result = [];
        foreach ($topicIdMap as $projectId => $topicId) {
            $sandboxId = $topicId !== null ? ($sandboxIdByTopicId[(int) $topicId] ?? null) : null;
            $result[$projectId] = $sandboxId !== null
                ? ($statusBySandboxId[$sandboxId] ?? null)
                : null;
        }

        return $result;
    }

    /**
     * Batch-resolve sandbox version upgrade requirement indexed by topic ID.
     *
     * @param array<int, null|int> $topicIdMap Map of projectId => topicId
     * @return array<int, null|bool> Map of topicId => needUpgrade
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
            $this->logger->warning('[MagicClaw] Failed to resolve need_upgrade in queries, version unknown', [
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

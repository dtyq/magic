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
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\CreateMagicClawRequestDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\UpdateMagicClawRequestDTO;
use Hyperf\Di\Annotation\Inject;
use Psr\EventDispatcher\EventDispatcherInterface;
use Qbhy\HyperfAuth\Authenticatable;

class MagicClawAppService extends AbstractSuperMagicAppService
{
    #[Inject]
    protected MagicClawDomainService $magicClawDomainService;

    #[Inject]
    protected EventDispatcherInterface $eventDispatcher;

    #[Inject]
    protected ProjectDomainService $projectDomainService;

    #[Inject]
    protected SandboxGatewayInterface $sandboxGateway;

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
     * Delete a magic claw.
     */
    public function delete(Authenticatable $authorization, string $code): void
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $this->magicClawDomainService->deleteClaw(
            $code,
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode()
        );
    }

    /**
     * Get paginated magic claw list with resolved icon URLs and sandbox status.
     * Each item in list contains 'entity' (MagicClawEntity) and 'status' (?string).
     *
     * @return array{total: int, list: array<array{entity: MagicClawEntity, status: null|string}>, page: int, page_size: int}
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

        // Resolve sandbox status and attach to each list item directly
        $statusByProjectId = $this->resolveSandboxStatusByProjectId($entities);
        $list = array_map(fn (MagicClawEntity $entity) => [
            'entity' => $entity,
            'status' => $statusByProjectId[$entity->getProjectId()] ?? null,
        ], $entities);

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
     * Batch-resolve sandbox running status indexed by project ID.
     * Flow: claws → projectIds → currentTopicIds (= sandboxIds) → getBatchSandboxStatus.
     *
     * @param MagicClawEntity[] $entities
     * @return array<int, null|string> Map of projectId => sandbox status string (null if unavailable)
     */
    private function resolveSandboxStatusByProjectId(array $entities): array
    {
        // Collect non-null project IDs from the claw list
        $projectIds = array_values(array_filter(
            array_map(fn (MagicClawEntity $e) => $e->getProjectId(), $entities)
        ));

        if (empty($projectIds)) {
            return [];
        }

        // Batch get projectId => currentTopicId mapping (topic_id is used as sandbox_id)
        $topicIdMap = $this->projectDomainService->getTopicIdMapByProjectIds($projectIds);

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

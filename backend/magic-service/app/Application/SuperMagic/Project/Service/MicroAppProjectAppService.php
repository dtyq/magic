<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Project\Service;

use App\Application\SuperMagic\Common\Service\AbstractAppService;
use App\Application\SuperMagic\Common\Share\Service\ResourceShareAppService;
use App\Application\SuperMagic\Project\DTO\Request\MicroAppListRequestDTO;
use App\Application\SuperMagic\Project\DTO\Request\PublishedMicroAppListRequestDTO;
use App\Application\SuperMagic\Project\DTO\Request\PublishMicroAppRequestDTO;
use App\Application\SuperMagic\Project\DTO\Request\UpdateMicroAppRequestDTO;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\Provider\Service\ModelFilter\PackageFilterInterface;
use App\Domain\SuperMagic\Common\Share\Constant\ResourceType;
use App\Domain\SuperMagic\Common\Share\Constant\ShareAccessType;
use App\Domain\SuperMagic\Common\Share\Entity\ResourceShareEntity;
use App\Domain\SuperMagic\Common\Share\Service\ResourceShareDomainService;
use App\Domain\SuperMagic\File\Repository\Facade\TaskFileRepositoryInterface;
use App\Domain\SuperMagic\Project\Entity\MicroAppEntity;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Entity\ValueObject\MemberRole;
use App\Domain\SuperMagic\Project\Entity\ValueObject\MicroAppListScope;
use App\Domain\SuperMagic\Project\Entity\ValueObject\MicroAppPublishStatus;
use App\Domain\SuperMagic\Project\Entity\ValueObject\ProjectMode;
use App\Domain\SuperMagic\Project\Event\ProjectUpdatedEvent;
use App\Domain\SuperMagic\Project\Repository\Facade\MicroAppRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Facade\MicroAppVisitRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Persistence\MicroAppTransferRepository;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Project\Service\ProjectMemberDomainService;
use App\Domain\SuperMagic\Workspace\Entity\ValueObject\WorkspaceType;
use App\Domain\SuperMagic\Workspace\Repository\Facade\WorkspaceRepositoryInterface;
use App\ErrorCode\GenericErrorCode;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\SuperMagic\Utils\ShareUrlBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\Common\Share\DTO\Request\CreateShareRequestDTO;
use Hyperf\DbConnection\Db;
use Psr\EventDispatcher\EventDispatcherInterface;
use Throwable;

class MicroAppProjectAppService extends AbstractAppService
{
    private const MENTION_SOURCE_FETCH_LIMIT = 1000;

    private const RUNTIME_PROJECT_KEY_PREFIX = 'micro-app-runtime_';

    public function __construct(
        private readonly MicroAppRepositoryInterface $microAppRepository,
        private readonly ProjectRepositoryInterface $projectRepository,
        private readonly WorkspaceRepositoryInterface $workspaceRepository,
        private readonly ResourceShareAppService $resourceShareAppService,
        private readonly ResourceShareDomainService $resourceShareDomainService,
        private readonly ShareUrlBuilder $shareUrlBuilder,
        private readonly ProjectDomainService $projectDomainService,
        private readonly ProjectAppService $projectAppService,
        private readonly ProjectMemberDomainService $projectMemberDomainService,
        private readonly MagicDepartmentUserDomainService $departmentUserDomainService,
        private readonly PackageFilterInterface $packageFilterService,
        private readonly EventDispatcherInterface $eventDispatcher,
        private readonly PublishedMicroAppResolver $publishedMicroAppResolver,
        private readonly PublishedMicroAppFileAccessService $publishedMicroAppFileAccessService,
        private readonly MicroAppProjectResponseFormatter $responseFormatter,
        private readonly MicroAppShareConfig $shareConfig,
        private readonly MicroAppVisitRepositoryInterface $microAppVisitRepository,
        private readonly TaskFileRepositoryInterface $taskFileRepository,
        private readonly MicroAppTransferRepository $mutationLocks,
    ) {
    }

    public function publish(RequestContext $requestContext, int $appId, PublishMicroAppRequestDTO $requestDTO): array
    {
        $authorization = $requestContext->getUserAuthorization();
        [, $initialProject] = $this->getValidatedMicroApp($appId);
        Db::beginTransaction();
        try {
            [$record, $project] = $this->lockMicroAppForMutation($appId, $initialProject->getId(), $authorization, MemberRole::MANAGE);
            $projectId = $project->getId();
            $projectNameChanged = $project->getProjectName() !== $requestDTO->getProjectName();
            $coverFileKey = $requestDTO->hasCoverFileKey() ? $requestDTO->getCoverFileKey() : $record->getCoverFileKey();
            $coverChanged = $record->getCoverFileKey() !== $coverFileKey;
            $defaultOpenFileId = $requestDTO->hasDefaultOpenFileId()
                ? $this->validateDefaultOpenFileId($requestDTO->getDefaultOpenFileId(), $projectId)
                : null;

            if ($record->getOrganizationCode() !== $project->getUserOrganizationCode()) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.access_denied');
            }

            $now = date('Y-m-d H:i:s');

            if ($projectNameChanged || $coverChanged) {
                $project
                    ->setProjectName($requestDTO->getProjectName())
                    ->setUpdatedUid($authorization->getId())
                    ->setUpdatedAt($now);
                $project = $this->projectDomainService->saveProjectEntity($project);
            }

            $shareData = [
                'resource_id' => $record->getResourceId(),
                'resource_type' => ResourceType::Project->value,
                'resource_name' => $project->getProjectName(),
                'project_id' => (string) $projectId,
                'share_type' => $requestDTO->getShareType(),
                'share_range' => $requestDTO->getShareType() === ShareAccessType::TeamShare->value ? $requestDTO->getShareRange() : null,
                'target_ids' => $requestDTO->getShareType() === ShareAccessType::TeamShare->value && $requestDTO->getShareRange() === 'designated'
                    ? $requestDTO->getTargetIds()
                    : [],
                'password' => $requestDTO->getShareType() === ShareAccessType::PasswordProtected->value ? $requestDTO->getPassword() : null,
                'share_project' => true,
                'show_share_url' => true,
            ];
            if ($requestDTO->hasExpireDays()) {
                $shareData['expire_days'] = $requestDTO->getExpireDays();
            }
            if ($requestDTO->hasDefaultOpenFileId()) {
                $shareData['default_open_file_id'] = $defaultOpenFileId;
            }
            if ($requestDTO->hasExtra()) {
                $existingShare = $this->resourceShareDomainService->getShareByResourceIdWithTrashed($record->getResourceId());
                $shareData['extra'] = $this->shareConfig->buildExtra($existingShare?->getExtra(), $requestDTO);
            }
            $shareDTO = CreateShareRequestDTO::fromArray($shareData);
            // The locked manager may configure this app, while the stable link belongs to its owner.
            $this->resourceShareAppService->assertMicroAppShareAllowed($authorization, $requestDTO->getShareType());
            $shareOwner = (new MagicUserAuthorization())->setId($project->getUserId())
                ->setOrganizationCode($project->getUserOrganizationCode());
            $shareItem = $this->resourceShareAppService->createShare($shareOwner, $shareDTO, 'micro_app');
            $this->mutationLocks->recordShareOperator($record, $authorization->getId());
            $accessUrl = $this->shareUrlBuilder->buildMicroAppShareUrl((string) $record->getId());

            $record
                ->setShareId($shareItem->id)
                ->setShareCode($shareItem->shareCode)
                ->setShareType($requestDTO->getShareType())
                ->setShareRange($requestDTO->getShareType() === ShareAccessType::TeamShare->value ? $requestDTO->getShareRange() : null)
                ->setTargetIds($requestDTO->getShareType() === ShareAccessType::TeamShare->value && $requestDTO->getShareRange() === 'designated' ? $requestDTO->getTargetIds() : [])
                ->setPublishStatus(MicroAppPublishStatus::Published->value)
                ->setAccessUrl($accessUrl)
                ->setCoverFileKey($coverFileKey)
                ->setPublishedAt($now)
                ->setUnpublishedAt(null);

            $record = $this->microAppRepository->save($record);
            Db::commit();
        } catch (Throwable $e) {
            Db::rollBack();
            throw $e;
        }

        if ($projectNameChanged || $coverChanged) {
            $this->eventDispatcher->dispatch(new ProjectUpdatedEvent($project, $authorization));
        }

        return $this->responseFormatter->formatPublishRecord(
            $record,
            $project->getProjectName(),
            $shareItem->extra,
            $shareItem->expireDays,
            $shareItem->expireAt,
            $shareItem->defaultOpenFileId,
        );
    }

    public function delete(RequestContext $requestContext, int $appId): array
    {
        [, $initialProject] = $this->getValidatedMicroApp($appId);
        return Db::transaction(function () use ($requestContext, $appId, $initialProject): array {
            [, $project] = $this->lockMicroAppForMutation(
                $appId,
                $initialProject->getId(),
                $requestContext->getUserAuthorization(),
                MemberRole::MANAGE
            );
            $this->projectAppService->deleteProject($requestContext, $project->getId());
            return ['app_id' => (string) $appId, 'project_id' => (string) $project->getId(), 'deleted' => true];
        });
    }

    public function update(RequestContext $requestContext, int $appId, UpdateMicroAppRequestDTO $requestDTO): array
    {
        if (! $requestDTO->hasUpdates()) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'app_name or cover_file_key is required');
        }

        $authorization = $requestContext->getUserAuthorization();
        [, $initialProject] = $this->getValidatedMicroApp($appId);
        Db::beginTransaction();
        try {
            [$record, $project] = $this->lockMicroAppForMutation($appId, $initialProject->getId(), $authorization, MemberRole::EDITOR);

            if ($record->getOrganizationCode() !== $project->getUserOrganizationCode()) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.access_denied');
            }

            $projectName = $requestDTO->hasAppName() ? $requestDTO->getAppName() : $project->getProjectName();
            $projectNameChanged = $project->getProjectName() !== $projectName;
            $coverFileKey = $requestDTO->hasCoverFileKey() ? $requestDTO->getCoverFileKey() : $record->getCoverFileKey();
            $coverChanged = $record->getCoverFileKey() !== $coverFileKey;
            if (! $projectNameChanged && ! $coverChanged) {
                Db::commit();
                return $this->responseFormatter->formatAppMetadata($record, $project);
            }

            $now = date('Y-m-d H:i:s');
            $project
                ->setProjectName($projectName ?? '')
                ->setUpdatedUid($authorization->getId())
                ->setUpdatedAt($now);
            $project = $this->projectDomainService->saveProjectEntity($project);

            if ($coverChanged) {
                $record->setCoverFileKey($coverFileKey);
                $record = $this->microAppRepository->save($record);
            }
            Db::commit();
        } catch (Throwable $e) {
            Db::rollBack();
            throw $e;
        }

        $this->eventDispatcher->dispatch(new ProjectUpdatedEvent($project, $authorization));

        return $this->responseFormatter->formatAppMetadata($record, $project);
    }

    public function unpublish(RequestContext $requestContext, int $appId): array
    {
        $authorization = $requestContext->getUserAuthorization();
        [, $initialProject] = $this->getValidatedMicroApp($appId);
        Db::beginTransaction();
        try {
            [$record, $project] = $this->lockMicroAppForMutation($appId, $initialProject->getId(), $authorization, MemberRole::MANAGE);

            if ($record->getOrganizationCode() !== $project->getUserOrganizationCode()) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'micro_app.publish_not_found');
            }

            if ($record->getPublishStatus() === MicroAppPublishStatus::Published->value) {
                $shareOwner = (new MagicUserAuthorization())->setId($project->getUserId())
                    ->setOrganizationCode($project->getUserOrganizationCode());
                $this->resourceShareAppService->cancelShareByResourceId($shareOwner, $record->getResourceId());
                $this->mutationLocks->recordShareOperator($record, $authorization->getId());
            }

            $record
                ->setPublishStatus(MicroAppPublishStatus::Unpublished->value)
                ->setUnpublishedAt(date('Y-m-d H:i:s'));

            $record = $this->microAppRepository->save($record);
            Db::commit();
        } catch (Throwable $e) {
            Db::rollBack();
            throw $e;
        }

        return $this->responseFormatter->formatPublishRecord($record, $project->getProjectName());
    }

    public function show(RequestContext $requestContext, int $appId): array
    {
        $authorization = $requestContext->getUserAuthorization();
        [$record, $project] = $this->getValidatedMicroApp($appId);

        try {
            $this->getAccessibleProject(
                $project->getId(),
                $authorization->getId(),
                $authorization->getOrganizationCode()
            );
        } catch (Throwable) {
            if (! $this->publishedMicroAppResolver->canAccessPublishedShare(
                $record->getId(),
                $authorization->getId(),
                $authorization->getOrganizationCode()
            )) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.access_denied');
            }
        }

        return $this->formatMicroAppResponse($record, $project, $authorization);
    }

    /** Query the current user's runtime project without creating it. */
    public function getRuntimeProject(RequestContext $requestContext, int $appId): array
    {
        $authorization = $requestContext->getUserAuthorization();
        $this->assertRuntimeProjectAccess($requestContext, $appId);
        $project = $this->projectAppService->findSpecialProject(
            $requestContext,
            self::RUNTIME_PROJECT_KEY_PREFIX . $appId,
        );

        return [
            'exists' => $project !== null,
            'project' => $project === null ? null : $this->formatRuntimeProject($project, $authorization),
        ];
    }

    /** Create or get the current user's runtime project. */
    public function ensureRuntimeProject(RequestContext $requestContext, int $appId): array
    {
        $authorization = $requestContext->getUserAuthorization();
        $this->assertRuntimeProjectAccess($requestContext, $appId);
        $result = $this->projectAppService->ensureMicroAppRuntimeProject(
            $requestContext,
            self::RUNTIME_PROJECT_KEY_PREFIX . $appId,
        );
        $project = $this->projectRepository->findById((int) ($result['project']['id'] ?? 0));

        $formattedProject = $project === null
            ? $result['project']
            : $this->formatRuntimeProject($project, $authorization);
        // Keep the role field present even if persistence returns no entity after creation.
        $formattedProject['user_role'] ??= null;

        return [
            'project' => $formattedProject,
            'is_existing' => (bool) $result['is_existing'],
        ];
    }

    public function showByProject(RequestContext $requestContext, int $projectId): array
    {
        $authorization = $requestContext->getUserAuthorization();
        $project = $this->projectRepository->findById($projectId);
        if ($project === null || ! $this->isMicroAppProject($project)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
        }

        $this->getAccessibleProject(
            $projectId,
            $authorization->getId(),
            $authorization->getOrganizationCode()
        );

        $record = $this->microAppRepository->ensureByProjectId(
            $projectId,
            $project->getUserOrganizationCode(),
            $project->getUserId(),
            $project->getCreatedUid(),
        );

        return $this->formatMicroAppResponse($record, $project, $authorization);
    }

    public function resolvePublished(int $appId): array
    {
        $publishedMicroApp = $this->publishedMicroAppResolver->findPublished($appId);
        if ($publishedMicroApp === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'micro_app.publish_not_found');
        }

        [$record, $shareEntity] = $publishedMicroApp;
        $response = $this->responseFormatter->formatPublishedResolution($record, $shareEntity);
        $response['icon_url'] = $this->publishedMicroAppResolver->getInstallIconUrl($record);

        return $response;
    }

    public function publishedList(RequestContext $requestContext, PublishedMicroAppListRequestDTO $requestDTO): array
    {
        $authorization = $requestContext->getUserAuthorization();
        $accessibleApps = $this->collectShareAccessiblePublishedApps(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
            $requestDTO->getKeyword(),
        );

        $items = [];
        foreach ($accessibleApps as $accessibleApp) {
            $items[] = [
                'project' => $this->responseFormatter->formatProject($accessibleApp['project']),
                'publish' => $this->responseFormatter->formatPublishRecord(
                    $accessibleApp['record'],
                    $accessibleApp['project']->getProjectName(),
                    $accessibleApp['share']->getExtra(),
                    $accessibleApp['share']->getExpireDays(),
                    $accessibleApp['share']->getExpireAt(),
                    $accessibleApp['share']->getDefaultOpenFileId() !== null ? (string) $accessibleApp['share']->getDefaultOpenFileId() : null,
                ),
            ];
        }

        $total = count($items);
        $page = $requestDTO->getPage();
        $pageSize = $requestDTO->getPageSize();

        return [
            'list' => array_slice($items, ($page - 1) * $pageSize, $pageSize),
            'total' => $total,
            'page' => $page,
            'page_size' => $pageSize,
        ];
    }

    public function list(RequestContext $requestContext, MicroAppListRequestDTO $requestDTO): array
    {
        $authorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($authorization);
        $userId = $authorization->getId();

        $departmentIds = $this->departmentUserDomainService->getDepartmentIdsByUserId(
            $dataIsolation,
            $userId,
            true
        );

        if ($requestDTO->getScope() === MicroAppListScope::Accessible) {
            $result = $this->paginateShareAccessiblePublishedApps(
                $authorization,
                $requestDTO->getKeyword(),
                $requestDTO->getPage(),
                $requestDTO->getPageSize(),
            );
        } else {
            $organizationCodes = $this->getAccessibleOrganizationCodes(
                $userId,
                $departmentIds,
                $authorization->getOrganizationCode()
            );
            $organizationCodes = array_values(array_unique(array_merge(
                [$authorization->getOrganizationCode()],
                $organizationCodes,
            )));

            $result = $this->microAppRepository->paginateAccessible(
                $userId,
                array_map('strval', $departmentIds),
                $organizationCodes,
                $requestDTO->getScope(),
                $requestDTO->getKeyword(),
                $requestDTO->getPage(),
                $requestDTO->getPageSize()
            );
        }

        return $this->formatAccessibleListResult(
            $result,
            $userId,
            array_map('strval', $departmentIds),
            $requestDTO->getPage(),
            $requestDTO->getPageSize(),
        );
    }

    public function mentionList(RequestContext $requestContext, PublishedMicroAppListRequestDTO $requestDTO): array
    {
        $authorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($authorization);
        $userId = $authorization->getId();
        $departmentIds = $this->departmentUserDomainService->getDepartmentIdsByUserId(
            $dataIsolation,
            $userId,
            true
        );
        $stringDepartmentIds = array_map('strval', $departmentIds);
        $organizationCodes = $this->getAccessibleOrganizationCodes(
            $userId,
            $departmentIds,
            $authorization->getOrganizationCode()
        );
        $organizationCodes = array_values(array_unique(array_merge(
            [$authorization->getOrganizationCode()],
            $organizationCodes,
        )));

        $accessible = $this->microAppRepository->paginateAccessible(
            $userId,
            $stringDepartmentIds,
            $organizationCodes,
            MicroAppListScope::All,
            $requestDTO->getKeyword(),
            1,
            self::MENTION_SOURCE_FETCH_LIMIT,
            false,
            true,
        );
        $published = $this->paginateShareAccessiblePublishedApps(
            $authorization,
            $requestDTO->getKeyword(),
            1,
            PHP_INT_MAX,
            teamOnly: true,
        );
        $merged = $this->filterMentionListRows(array_merge(
            $accessible['list'] ?? [],
            $published['list'],
        ));
        $page = $requestDTO->getPage();
        $pageSize = $requestDTO->getPageSize();

        return $this->formatAccessibleListResult(
            [
                'total' => count($merged),
                'list' => array_slice($merged, ($page - 1) * $pageSize, $pageSize),
            ],
            $userId,
            $stringDepartmentIds,
            $page,
            $pageSize,
        );
    }

    public function recordVisit(RequestContext $requestContext, int $appId): array
    {
        $authorization = $requestContext->getUserAuthorization();
        [$record, $project] = $this->getValidatedMicroApp($appId);
        $this->getAccessibleProject($project->getId(), $authorization->getId(), $authorization->getOrganizationCode());
        $this->microAppVisitRepository->recordVisit($record->getId(), $authorization->getId(), $authorization->getOrganizationCode());

        return ['recorded' => true];
    }

    /**
     * Runtime projects are user-owned special projects, but the role remains
     * part of the response so every client can fail closed before rendering
     * file write actions.
     */
    private function formatRuntimeProject(ProjectEntity $project, MagicUserAuthorization $authorization): array
    {
        $formatted = $this->responseFormatter->formatProject($project);
        $formatted['user_role'] = $this->resolveUserRole($project, $authorization);

        return $formatted;
    }

    /**
     * @return array{0: MicroAppEntity, 1: ProjectEntity}
     */
    private function lockMicroAppForMutation(int $appId, int $projectId, MagicUserAuthorization $authorization, MemberRole $role): array
    {
        $project = $this->mutationLocks->lockProject($projectId);
        $record = $project === null ? null : $this->mutationLocks->lockAppByProject($projectId, $project->getUserOrganizationCode());
        if ($project === null || $record === null || $record->getId() !== $appId || $record->getDeletedAt() !== null
            || $project->getUserOrganizationCode() !== $authorization->getOrganizationCode()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
        }
        $this->getAccessibleProject($projectId, $authorization->getId(), $authorization->getOrganizationCode(), $role);
        return [$record, $project];
    }

    private function getValidatedMicroApp(int $appId): array
    {
        $record = $this->microAppRepository->findById($appId);
        if ($record === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
        }

        $project = $this->projectRepository->findById($record->getProjectId());
        if ($project === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
        }

        if (! $this->isMicroAppProject($project)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::VALIDATE_FAILED, 'micro_app.invalid_project_type');
        }

        return [$record, $project];
    }

    private function assertRuntimeProjectAccess(RequestContext $requestContext, int $appId): void
    {
        $authorization = $requestContext->getUserAuthorization();
        [$record, $project] = $this->getValidatedMicroApp($appId);
        $organizationCode = $authorization->getOrganizationCode();
        $sourceOrganizationCode = $record->getOrganizationCode();
        $projectOrganizationCode = $project->getUserOrganizationCode();
        if ($organizationCode === '' || $sourceOrganizationCode === '' || $projectOrganizationCode === ''
            || $sourceOrganizationCode !== $projectOrganizationCode
            || $sourceOrganizationCode !== $organizationCode) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::PROJECT_ACCESS_DENIED,
                'micro_app.cross_organization_conversation_unsupported'
            );
        }

        try {
            $this->getAccessibleProject(
                $project->getId(),
                $authorization->getId(),
                $authorization->getOrganizationCode(),
            );
            return;
        } catch (Throwable) {
            $published = $this->publishedMicroAppResolver->findPublished($record->getId());
            if ($published === null) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.access_denied');
            }

            [, $share] = $published;
            if ($share->getShareType() === ShareAccessType::PasswordProtected->value) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'micro_app.password_conversation_unsupported');
            }

            if (! $this->publishedMicroAppFileAccessService->canAccessProject(
                $record->getProjectId(),
                $authorization->getId(),
                $authorization->getOrganizationCode(),
            )) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.access_denied');
            }
        }
    }

    private function isMicroAppProject(ProjectEntity $project): bool
    {
        if ($project->getProjectMode() === ProjectMode::MICRO_APP->value) {
            return true;
        }

        $workspaceId = $project->getWorkspaceId();
        if ($workspaceId === null) {
            return false;
        }

        $workspace = $this->workspaceRepository->getWorkspaceById($workspaceId);
        return $workspace !== null && $workspace->getWorkspaceType() === WorkspaceType::MicroApp->value;
    }

    private function formatMicroAppResponse(
        MicroAppEntity $record,
        ProjectEntity $project,
        MagicUserAuthorization $authorization,
    ): array {
        $response = $this->responseFormatter->formatMicroApp($record, $project);
        $response['project']['user_role'] = $this->resolveUserRole($project, $authorization);

        return $response;
    }

    private function resolveUserRole(ProjectEntity $project, MagicUserAuthorization $authorization): ?string
    {
        $userId = $authorization->getId();
        if ($project->getUserId() === $userId) {
            return MemberRole::OWNER->value;
        }

        $departmentIds = $this->departmentUserDomainService->getDepartmentIdsByUserId(
            $this->createDataIsolation($authorization),
            $userId,
            true,
        );
        $roles = $this->projectMemberDomainService->getUserHighestRolesInProjects(
            [$project->getId()],
            array_values(array_unique(array_merge([$userId], array_map('strval', $departmentIds)))),
        );

        return $roles[$project->getId()] ?? null;
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<int, array<string, mixed>>
     */
    private function filterMentionListRows(array $rows): array
    {
        $filtered = [];
        foreach ($rows as $row) {
            if (! in_array((string) ($row['publish_status'] ?? ''), [
                MicroAppPublishStatus::Published->value,
                MicroAppPublishStatus::Unpublished->value,
            ], true)) {
                continue;
            }
            $appId = (string) ($row['app_id'] ?? '');
            if ($appId === '') {
                continue;
            }
            $filtered[$appId] = $row;
        }

        $rows = array_values($filtered);
        usort($rows, static function (array $left, array $right): int {
            $updatedCompare = ((string) ($right['updated_at'] ?? '')) <=> ((string) ($left['updated_at'] ?? ''));
            if ($updatedCompare !== 0) {
                return $updatedCompare;
            }

            return ((int) ($right['app_id'] ?? 0)) <=> ((int) ($left['app_id'] ?? 0));
        });

        return $rows;
    }

    /**
     * @return array{total:int,list:array<int,array<string,mixed>>}
     */
    private function paginateShareAccessiblePublishedApps(
        MagicUserAuthorization $authorization,
        string $keyword,
        int $page,
        int $pageSize,
        bool $teamOnly = false,
    ): array {
        $rows = [];
        foreach ($this->collectShareAccessiblePublishedApps(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
            $keyword,
            true,
            $teamOnly,
        ) as $accessibleApp) {
            $record = $accessibleApp['record'];
            $project = $accessibleApp['project'];
            $rows[] = [
                'app_id' => $record->getId(),
                'project_id' => $project->getId(),
                'app_name' => $project->getProjectName(),
                'app_description' => $project->getProjectDescription(),
                'creator_id' => $record->getCreatorId(),
                'cover_file_key' => $record->getCoverFileKey(),
                'publish_status' => $record->getPublishStatus(),
                'updated_at' => $project->getUpdatedAt(),
                'project_owner_id' => $project->getUserId(),
                'organization_code' => $project->getUserOrganizationCode(),
            ];
        }

        $total = count($rows);

        return [
            'total' => $total,
            'list' => array_slice($rows, ($page - 1) * $pageSize, $pageSize),
        ];
    }

    /**
     * @return array<int, array{record: MicroAppEntity, project: ProjectEntity, share: ResourceShareEntity}>
     */
    private function collectShareAccessiblePublishedApps(
        string $organizationCode,
        string $userId,
        string $keyword,
        bool $excludePasswordProtected = false,
        bool $teamOnly = false,
    ): array {
        $records = $this->microAppRepository->findPublishedByOrganization($organizationCode);
        $projectIds = array_values(array_unique(array_map(
            static fn (MicroAppEntity $record): int => $record->getProjectId(),
            $records
        )));
        $projects = [];
        foreach ($this->projectRepository->findByIds($projectIds) as $project) {
            $projects[$project->getId()] = $project;
        }

        $candidates = [];
        $resourceIds = [];
        foreach ($records as $record) {
            $project = $projects[$record->getProjectId()] ?? null;
            if ($project === null || ! $this->isMicroAppProject($project)) {
                continue;
            }
            if ($keyword !== '' && ! $this->containsKeyword($project->getProjectName(), $keyword)) {
                continue;
            }

            $resourceId = $record->getResourceId();
            if ($resourceId === '') {
                continue;
            }
            $candidates[] = [
                'record' => $record,
                'project' => $project,
            ];
            $resourceIds[] = $resourceId;
        }

        $resourceIds = array_values(array_unique($resourceIds));
        $sharesByResourceId = [];
        foreach ($this->resourceShareDomainService->getSharesByResourceIds($resourceIds) as $shareEntity) {
            $resourceId = $shareEntity->getResourceId();
            if ($resourceId === '' || isset($sharesByResourceId[$resourceId])) {
                continue;
            }
            $sharesByResourceId[$resourceId] = $shareEntity;
        }

        $accessibleApps = [];
        foreach ($candidates as $candidate) {
            $shareEntity = $sharesByResourceId[$candidate['record']->getResourceId()] ?? null;
            if ($shareEntity === null || ! $shareEntity->isValid()) {
                continue;
            }
            if ($excludePasswordProtected && $shareEntity->getShareType() === ShareAccessType::PasswordProtected->value) {
                continue;
            }
            if ($teamOnly && ! PublishedMicroAppFileAccessService::supportsShare(
                $candidate['record'],
                $candidate['project'],
                $shareEntity,
                $organizationCode,
            )) {
                continue;
            }
            if (! $this->canAccessShare($shareEntity, $userId, $organizationCode)) {
                continue;
            }

            $accessibleApps[] = [
                'record' => $candidate['record'],
                'project' => $candidate['project'],
                'share' => $shareEntity,
            ];
        }

        return $accessibleApps;
    }

    /**
     * @param array{total:int,list:array<int,array<string,mixed>>} $result
     * @param string[] $departmentIds
     * @return array{list:array<int,array<string,mixed>>,total:int,page:int,page_size:int}
     */
    private function formatAccessibleListResult(
        array $result,
        string $userId,
        array $departmentIds,
        int $page,
        int $pageSize
    ): array {
        $coverUrls = $this->responseFormatter->resolveCoverUrls($result['list']);
        $projectIds = array_values(array_unique(array_map(
            static fn (array $row): int => (int) ($row['project_id'] ?? 0),
            $result['list']
        )));
        $projectIds = array_values(array_filter($projectIds));
        $targetIds = array_values(array_unique(array_merge([$userId], $departmentIds)));
        $userRoles = $this->projectMemberDomainService->getUserHighestRolesInProjects($projectIds, $targetIds);
        $items = [];
        foreach ($result['list'] as $row) {
            $appId = (string) ($row['app_id'] ?? '');
            $projectId = (int) ($row['project_id'] ?? 0);
            $isOwner = (string) ($row['project_owner_id'] ?? '') === $userId;
            $coverKey = (string) ($row['cover_file_key'] ?? '');
            $items[] = [
                'app_id' => $appId,
                'project_id' => (string) $projectId,
                'app_name' => (string) ($row['app_name'] ?? ''),
                'app_description' => (string) ($row['app_description'] ?? ''),
                'creator_id' => (string) ($row['creator_id'] ?? ''),
                'cover_url' => $coverUrls[$this->responseFormatter->coverUrlMapKey($row, $coverKey)] ?? '',
                'publish_status' => (string) ($row['publish_status'] ?? MicroAppPublishStatus::Unpublished->value),
                'updated_at' => ($row['updated_at'] ?? null) !== null ? (string) $row['updated_at'] : null,
                'user_role' => $isOwner ? MemberRole::OWNER->value : ($userRoles[$projectId] ?? null),
                'can_delete' => $isOwner,
            ];
        }

        return [
            'list' => $items,
            'total' => (int) $result['total'],
            'page' => $page,
            'page_size' => $pageSize,
        ];
    }

    private function canAccessShare(ResourceShareEntity $shareEntity, string $userId, string $organizationCode): bool
    {
        try {
            $this->resourceShareDomainService->validateShareAccess(
                $shareEntity,
                $userId,
                $organizationCode,
                $shareEntity->getShareCode()
            );
            return true;
        } catch (Throwable) {
            return false;
        }
    }

    private function containsKeyword(string $haystack, string $needle): bool
    {
        if (function_exists('mb_stripos')) {
            return mb_stripos($haystack, $needle) !== false;
        }

        return stripos($haystack, $needle) !== false;
    }

    private function validateDefaultOpenFileId(?string $fileId, int $projectId): ?string
    {
        if ($fileId === null || $fileId === '') {
            return null;
        }
        if (! ctype_digit($fileId) || (int) $fileId <= 0) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'default_open_file_id is invalid');
        }

        $file = $this->taskFileRepository->getFilesByIds([(int) $fileId], $projectId)[0] ?? null;
        if ($file === null
            || $file->getProjectId() !== $projectId
            || $file->getDeletedAt() !== null
            || $file->getIsHidden()
            || $file->getIsDirectory()
            || ! in_array(strtolower($file->getFileExtension()), ['html', 'htm'], true)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'default_open_file_id is invalid');
        }

        return (string) $file->getFileId();
    }

    /**
     * @param string[] $departmentIds
     * @return string[]
     */
    private function getAccessibleOrganizationCodes(string $userId, array $departmentIds, string $currentOrganizationCode): array
    {
        $targetIds = array_values(array_unique(array_merge([$userId], $departmentIds)));
        $projectIds = $this->projectMemberDomainService->getProjectIdsByCollaboratorTargets($targetIds);
        $organizationCodes = $this->projectDomainService->getOrganizationCodesByProjectIds($projectIds);
        $paidOrganizationCodes = $this->packageFilterService->filterPaidOrganizations($organizationCodes);

        return array_values(array_unique(array_merge($paidOrganizationCodes, [$currentOrganizationCode])));
    }
}

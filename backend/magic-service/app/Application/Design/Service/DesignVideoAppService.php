<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Service;

use App\Application\Design\Event\Message\DesignVideoPollMessage;
use App\Application\Design\Event\Publish\DesignVideoPollDelayPublisher;
use App\Domain\Design\Entity\DesignGenerationTaskEntity;
use App\Domain\Design\Entity\ValueObject\DesignGenerationStatus;
use App\Domain\Design\Factory\PathFactory;
use App\Domain\Design\Service\DesignGenerationTaskDomainService;
use App\Domain\Design\Service\DesignVideoSubmissionDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\VideoCatalog\Entity\ValueObject\VideoCatalogModelDefinition;
use App\Domain\VideoCatalog\Service\VideoCatalogQueryDomainService;
use App\ErrorCode\DesignErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MemberRole;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Hyperf\Amqp\Producer;
use Hyperf\Database\Exception\QueryException;
use Qbhy\HyperfAuth\Authenticatable;
use Throwable;

class DesignVideoAppService extends DesignAppService
{
    // 给 payload builder 的能力标记：支持图片 URL 时就不再转 base64。
    private const string REQUEST_KEY_SUPPORTS_IMAGE_INPUT_URL = 'supports_image_input_url';

    public function __construct(
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly FileDomainService $fileDomainService,
        private readonly VideoCatalogQueryDomainService $videoCatalogDomainService,
        private readonly DesignGenerationTaskDomainService $designGenerationTaskDomainService,
        private readonly DesignVideoSubmissionDomainService $submissionDomainService,
        private readonly Producer $producer,
    ) {
    }

    public function create(Authenticatable $authenticatable, DesignGenerationTaskEntity $entity): DesignGenerationTaskEntity
    {
        $designDataIsolation = $this->createDesignDataIsolation($authenticatable);
        $project = $this->assertProjectAccess($designDataIsolation, $entity->getProjectId(), MemberRole::EDITOR);
        $modelDefinition = $this->findModelOrFail($entity->getModelId());
        $this->assertWorkspacePathsExist(
            $designDataIsolation->getCurrentOrganizationCode(),
            $project->getId(),
            $entity
        );

        $existingEntity = $this->designGenerationTaskDomainService->findVideoTask($designDataIsolation, $project->getId(), $entity->getGenerationId());
        if ($existingEntity !== null) {
            return $this->prepareResponseEntity($project, $existingEntity);
        }

        $requestPayload = $entity->getRequestPayload();
        $businessParams = [
            'organization_code' => $designDataIsolation->getCurrentOrganizationCode(),
            'user_id' => $designDataIsolation->getCurrentUserId(),
            'project_id' => $entity->getProjectId(),
            'video_id' => $entity->getGenerationId(),
            'source_id' => 'design_video_generation',
        ];
        if (isset($requestPayload['topic_id'])) {
            $businessParams['magic_topic_id'] = $requestPayload['topic_id'];
            unset($requestPayload['topic_id']);
        }
        if (isset($requestPayload['task_id'])) {
            $businessParams['magic_task_id'] = $requestPayload['task_id'];
            unset($requestPayload['task_id']);
        }
        // 先在请求体里写入能力开关，后续 builder 就能无状态地选择图片输入格式。
        $requestPayload[self::REQUEST_KEY_SUPPORTS_IMAGE_INPUT_URL] = $this->supportsImageInputUrl($modelDefinition);
        $requestPayload['business_params'] = $businessParams;
        $entity->setOrganizationCode($designDataIsolation->getCurrentOrganizationCode());
        $entity->setUserId($designDataIsolation->getCurrentUserId());
        $entity->setRequestPayload($requestPayload);

        // 写入任务记录，幂等处理并发重复写入
        try {
            $this->designGenerationTaskDomainService->createTask($designDataIsolation, $entity);
        } catch (Throwable $throwable) {
            if ($this->isDuplicateGenerationTask($throwable)) {
                $duplicateEntity = $this->designGenerationTaskDomainService->findVideoTask($designDataIsolation, $project->getId(), $entity->getGenerationId());
                if ($duplicateEntity !== null) {
                    return $this->prepareResponseEntity($project, $duplicateEntity);
                }
            }
            throw $throwable;
        }

        // 调用外部网关提交任务，失败则删除任务记录
        try {
            $providerPayload = $this->submissionDomainService->submit($entity);
        } catch (Throwable $throwable) {
            $this->designGenerationTaskDomainService->deleteTask($designDataIsolation, $entity);
            throw $throwable;
        }

        $this->designGenerationTaskDomainService->markAsSubmitted($designDataIsolation, $entity, $providerPayload);

        // 投递首次 poll 消息，失败则记录重试信息，由 crontab 兜底恢复
        try {
            $this->producer->produce($this->buildInitialPollPublisher($entity));
            $this->designGenerationTaskDomainService->markFirstPollSent($designDataIsolation, $entity);
        } catch (Throwable $throwable) {
            $this->designGenerationTaskDomainService->markFirstPollDispatchFailed(
                $designDataIsolation,
                $entity,
                $throwable->getMessage(),
                $this->buildFirstPollNextRetryAt()
            );
            ExceptionBuilder::throw(DesignErrorCode::ThirdPartyServiceError, 'design.video_generation.first_poll_dispatch_failed');
        }

        return $this->prepareResponseEntity($project, $entity);
    }

    public function query(Authenticatable $authenticatable, int $projectId, string $videoId): DesignGenerationTaskEntity
    {
        $designDataIsolation = $this->createDesignDataIsolation($authenticatable);
        $project = $this->assertProjectAccess($designDataIsolation, $projectId, MemberRole::VIEWER);

        $entity = $this->designGenerationTaskDomainService->findVideoTask($designDataIsolation, $projectId, $videoId);
        if ($entity === null) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'common.not_found', ['label' => $videoId]);
        }

        if ($entity->getStatus() === DesignGenerationStatus::COMPLETED) {
            $this->hydrateCompletedTaskFiles($project, $entity);
        }

        return $entity;
    }

    private function findModelOrFail(string $modelId): VideoCatalogModelDefinition
    {
        $modelDefinition = $this->videoCatalogDomainService->findModel($modelId);
        if ($modelDefinition === null) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'common.not_found', ['label' => $modelId]);
        }

        return $modelDefinition;
    }

    private function supportsImageInputUrl(VideoCatalogModelDefinition $modelDefinition): bool
    {
        return $modelDefinition->getProviderCode() === ProviderCode::VolcengineArk->value;
    }

    private function assertWorkspacePathsExist(string $organizationCode, int $projectId, DesignGenerationTaskEntity $entity): void
    {
        $filePrefix = $this->fileDomainService->getFullPrefix($organizationCode);
        $workspacePrefix = PathFactory::getWorkspacePrefix($filePrefix, $projectId);
        $fullFileDir = PathFactory::buildFullDirPath($filePrefix, $projectId, $entity->getFileDir());

        $taskFileDir = $this->taskFileDomainService->getByFileKey($fullFileDir);
        if (! $taskFileDir || ! $taskFileDir->getIsDirectory()) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'design.video_generation.file_dir_not_exists', ['file_dir' => $entity->getFileDir()]);
        }

        $inputPayload = $entity->getInputPayload();

        foreach ((array) ($inputPayload['reference_images'] ?? []) as $referenceImage) {
            $this->assertWorkspaceFileExists($workspacePrefix, (string) ($referenceImage['uri'] ?? ''));
        }

        foreach ((array) ($inputPayload['reference_videos'] ?? []) as $referenceVideo) {
            $this->assertWorkspaceFileExists($workspacePrefix, (string) ($referenceVideo['uri'] ?? ''));
        }

        foreach ((array) ($inputPayload['reference_audios'] ?? []) as $referenceAudio) {
            $this->assertWorkspaceFileExists($workspacePrefix, (string) ($referenceAudio['uri'] ?? ''));
        }

        $maskUri = (string) ($inputPayload['mask']['uri'] ?? '');
        if ($maskUri !== '') {
            $this->assertWorkspaceFileExists($workspacePrefix, $maskUri);
        }

        foreach ((array) ($inputPayload['frames'] ?? []) as $frame) {
            $this->assertWorkspaceFileExists($workspacePrefix, (string) ($frame['uri'] ?? ''));
        }
    }

    private function assertWorkspaceFileExists(string $workspacePrefix, string $relativePath): void
    {
        $taskFile = $this->taskFileDomainService->getByFileKey($workspacePrefix . $relativePath);
        if (! $taskFile || $taskFile->getIsDirectory()) {
            ExceptionBuilder::throw(
                DesignErrorCode::InvalidArgument,
                'design.video_generation.reference_file_not_exists',
                ['file_key' => $relativePath]
            );
        }
    }

    private function prepareResponseEntity(ProjectEntity $project, DesignGenerationTaskEntity $entity): DesignGenerationTaskEntity
    {
        if ($entity->getStatus() === DesignGenerationStatus::COMPLETED) {
            $this->hydrateCompletedTaskFiles($project, $entity);
        }

        return $entity;
    }

    private function hydrateCompletedTaskFiles(ProjectEntity $project, DesignGenerationTaskEntity $entity): void
    {
        $filePrefix = $this->fileDomainService->getFullPrefix($entity->getOrganizationCode());
        $relativeFilePath = (string) ($entity->getOutputPayload()['relative_file_path'] ?? '');
        if ($relativeFilePath !== '') {
            $taskFile = $this->taskFileDomainService->getByFileKey(PathFactory::getWorkspacePrefix($filePrefix, $entity->getProjectId()) . $relativeFilePath);
            if ($taskFile) {
                $entity->setFileId($taskFile->getFileId());
                $entity->setFileUrl(
                    $this->taskFileDomainService->getFileUrls(
                        projectOrganizationCode: $project->getUserOrganizationCode(),
                        projectId: $project->getId(),
                        fileIds: [$taskFile->getFileId()],
                        downloadMode: 'preview'
                    )[0]['url'] ?? null
                );
            } else {
                $entity->setStatus(DesignGenerationStatus::FAILED);
                $entity->setErrorMessage('Generated video file not found');
            }
        }

        $relativePosterPath = (string) ($entity->getOutputPayload()['relative_poster_path'] ?? '');
        if ($relativePosterPath !== '') {
            $posterTaskFile = $this->taskFileDomainService->getByFileKey(PathFactory::getWorkspacePrefix($filePrefix, $entity->getProjectId()) . $relativePosterPath);
            if ($posterTaskFile) {
                $entity->setPosterFileId($posterTaskFile->getFileId());
                $entity->setPosterUrl(
                    $this->taskFileDomainService->getFileUrls(
                        projectOrganizationCode: $project->getUserOrganizationCode(),
                        projectId: $project->getId(),
                        fileIds: [$posterTaskFile->getFileId()],
                        downloadMode: 'preview'
                    )[0]['url'] ?? null
                );
            }
        }
    }

    private function buildInitialPollPublisher(DesignGenerationTaskEntity $entity): DesignVideoPollDelayPublisher
    {
        return new DesignVideoPollDelayPublisher(new DesignVideoPollMessage(
            $entity->getOrganizationCode(),
            $entity->getProjectId(),
            $entity->getGenerationId(),
        ));
    }

    private function buildFirstPollNextRetryAt(): string
    {
        return date(DATE_ATOM, time() + 60);
    }

    private function isDuplicateGenerationTask(Throwable $throwable): bool
    {
        return $throwable instanceof QueryException
            && $throwable->getCode() === '23000'
            && str_contains($throwable->getMessage(), 'Duplicate entry');
    }
}

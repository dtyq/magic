<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Event\Subscribe;

use App\Application\Design\Event\Message\DesignVideoPollMessage;
use App\Application\Design\Event\Publish\DesignVideoPollDelayPublisher;
use App\Application\Design\Tool\VideoGeneration\DesignGeneratedVideoFileNameTool;
use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\DesignGenerationTaskEntity;
use App\Domain\Design\Factory\PathFactory;
use App\Domain\Design\Service\DesignGenerationTaskDomainService;
use App\Domain\File\Service\FileDomainService;
use App\ErrorCode\DesignErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Design\Contract\VideoGatewayClientInterface;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\FileType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskFileSource;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Hyperf\Amqp\Annotation\Consumer;
use Hyperf\Amqp\Message\ConsumerMessage;
use Hyperf\Amqp\Producer;
use Hyperf\Amqp\Result;
use Hyperf\DbConnection\Db;
use PhpAmqpLib\Message\AMQPMessage;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Translation\trans;

#[Consumer(
    exchange: 'design.videos.poll',
    routingKey: 'design.videos.poll',
    queue: 'design.videos.poll',
    nums: 1
)]
class DesignVideoPollConsumer extends ConsumerMessage
{
    public function __construct(
        private readonly DesignGenerationTaskDomainService $domainService,
        private readonly VideoGatewayClientInterface $videoGatewayClient,
        private readonly Producer $producer,
        private readonly FileDomainService $fileDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly ProjectDomainService $projectDomainService,
        private readonly DesignGeneratedVideoFileNameTool $generatedVideoFileNameTool,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function consumeMessage($data, AMQPMessage $message): Result
    {
        $msg = DesignVideoPollMessage::fromArray((array) $data);
        if ($msg->organizationCode === '' || $msg->projectId <= 0 || $msg->generationId === '') {
            return Result::ACK;
        }

        $dataIsolation = DesignDataIsolation::create($msg->organizationCode);
        $entity = $this->domainService->findVideoTask($dataIsolation, $msg->projectId, $msg->generationId);
        if ($entity === null || $entity->isFinal()) {
            return Result::ACK;
        }

        $dataIsolation = DesignDataIsolation::create($msg->organizationCode, $entity->getUserId());

        $operationId = $entity->getOperationId();
        if ($operationId === '') {
            $this->logger->error('design video poll mark failed', [
                'reason' => 'operation_id_missing',
                'video_id' => $entity->getGenerationId(),
                'project_id' => $entity->getProjectId(),
                'organization_code' => $entity->getOrganizationCode(),
                'operation_id' => $operationId,
                'error' => trans('design.video_generation.operation_id_missing'),
            ]);
            $this->domainService->markAsFailed($dataIsolation, $entity, trans('design.video_generation.operation_id_missing'));
            return Result::ACK;
        }

        if (! $entity->canPoll()) {
            return Result::ACK;
        }

        $deadlineAt = $entity->getPollDeadlineAt();
        if ($deadlineAt !== null && strtotime($deadlineAt) !== false && time() > strtotime($deadlineAt)) {
            $this->logger->error('design video poll mark failed', [
                'reason' => 'timeout',
                'video_id' => $entity->getGenerationId(),
                'project_id' => $entity->getProjectId(),
                'organization_code' => $entity->getOrganizationCode(),
                'operation_id' => $operationId,
                'submitted_at' => $entity->getProviderPayload()['submitted_at'] ?? null,
                'deadline_at' => $deadlineAt,
                'error' => trans('design.video_generation.timeout'),
            ]);
            $this->domainService->markAsFailed($dataIsolation, $entity, trans('design.video_generation.timeout'));
            return Result::ACK;
        }

        try {
            $result = $this->videoGatewayClient->queryVideo($operationId, [
                'organization_code' => $entity->getOrganizationCode(),
                'user_id' => $entity->getUserId(),
            ]);
        } catch (BusinessException $exception) {
            $this->handleQueryFailure($dataIsolation, $entity, $msg, $exception);
            return Result::ACK;
        } catch (Throwable $throwable) {
            $this->handleQueryFailure($dataIsolation, $entity, $msg, $throwable);
            return Result::ACK;
        }

        $this->domainService->syncRuntimeSnapshot($dataIsolation, $entity, $result);

        $status = (string) ($result['status'] ?? '');
        if (in_array($status, ['queued', 'running'], true)) {
            $this->producer->produce(new DesignVideoPollDelayPublisher($msg));
            return Result::ACK;
        }

        if (in_array($status, ['failed', 'canceled'], true)) {
            $error = is_array($result['error'] ?? null) ? $result['error'] : [];
            $this->logger->error('design video poll mark failed', [
                'reason' => 'provider_failed_status',
                'video_id' => $entity->getGenerationId(),
                'project_id' => $entity->getProjectId(),
                'organization_code' => $entity->getOrganizationCode(),
                'operation_id' => $operationId,
                'status' => $status,
                'provider_result' => is_array($result['provider_result'] ?? null) ? $result['provider_result'] : [],
                'error' => $error,
            ]);
            $this->domainService->markAsFailed(
                $dataIsolation,
                $entity,
                (string) ($error['message'] ?? 'video generation failed'),
                $error['code'] ?? null
            );
            return Result::ACK;
        }

        if ($status !== 'succeeded') {
            $this->logger->error('design video poll mark failed', [
                'reason' => 'invalid_status',
                'video_id' => $entity->getGenerationId(),
                'project_id' => $entity->getProjectId(),
                'organization_code' => $entity->getOrganizationCode(),
                'operation_id' => $operationId,
                'status' => $status,
                'provider_result' => is_array($result['provider_result'] ?? null) ? $result['provider_result'] : [],
                'error' => trans('design.video_generation.invalid_status'),
            ]);
            $this->domainService->markAsFailed($dataIsolation, $entity, trans('design.video_generation.invalid_status'));
            return Result::ACK;
        }

        try {
            $this->archiveFiles($dataIsolation, $entity, $result);
        } catch (Throwable $throwable) {
            $this->logger->error('design video poll archive failed', [
                'video_id' => $entity->getGenerationId(),
                'project_id' => $entity->getProjectId(),
                'organization_code' => $entity->getOrganizationCode(),
                'operation_id' => $operationId,
                'error' => $throwable->getMessage(),
            ]);
            $this->logger->error('design video poll mark failed', [
                'reason' => 'archive_failed',
                'video_id' => $entity->getGenerationId(),
                'project_id' => $entity->getProjectId(),
                'organization_code' => $entity->getOrganizationCode(),
                'operation_id' => $operationId,
                'error' => $throwable->getMessage(),
            ]);
            $this->domainService->markAsFailed($dataIsolation, $entity, $throwable->getMessage());
        }

        return Result::ACK;
    }

    /**
     * @param array<string, mixed> $result
     */
    protected function archiveFiles(DesignDataIsolation $dataIsolation, DesignGenerationTaskEntity $entity, array $result): void
    {
        $output = is_array($result['output'] ?? null) ? $result['output'] : [];
        $videoUrl = trim((string) ($output['video_url'] ?? ''));
        if ($videoUrl === '') {
            ExceptionBuilder::throw(
                DesignErrorCode::ThirdPartyServiceError,
                'design.video_generation.video_url_missing'
            );
        }

        $project = $this->projectDomainService->getProjectNotUserId($entity->getProjectId());
        if (! $project) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'design.video_generation.project_not_exists', ['project_id' => $entity->getProjectId()]);
        }

        $filePrefix = $this->fileDomainService->getFullPrefix($entity->getOrganizationCode());
        // 归档目录优先按创建时记录的 file_dir_id 查找；旧任务没有 ID 时再按原路径兜底。
        $archiveDirectory = $this->resolveArchiveDirectory($entity, $filePrefix);
        $taskFileDir = $archiveDirectory['task_file_dir'] ?? null;
        $fullFileDir = (string) ($archiveDirectory['full_file_dir'] ?? PathFactory::buildFullDirPath($filePrefix, $entity->getProjectId(), $entity->getFileDir()));
        $relativeFileDir = (string) ($archiveDirectory['relative_file_dir'] ?? $entity->getFileDir());
        $fileDirExists = $taskFileDir instanceof TaskFileEntity;

        if (! $fileDirExists) {
            $this->logger->warning('design video poll archive skipped: file dir not found, completing without file archive', [
                'video_id' => $entity->getGenerationId(),
                'project_id' => $entity->getProjectId(),
                'organization_code' => $entity->getOrganizationCode(),
                'file_dir' => $entity->getFileDir(),
                'file_dir_id' => $entity->getOutputDirectoryFileId(),
            ]);
        }

        // 若用户未显式指定 file_name，则在归档前尝试生成智能文件名；失败时继续沿用默认 video_时间戳 命名。
        if (trim($entity->getFileName()) === '') {
            $resolvedBaseName = $this->generatedVideoFileNameTool->resolveBaseNameWithoutExtension(
                $dataIsolation,
                $entity,
                $entity->getPrompt(),
            );
            if ($resolvedBaseName !== '') {
                $entity->setFileName($resolvedBaseName);
            }
        }

        $fileName = $this->domainService->buildFinalVideoFileName($entity, $videoUrl);
        $posterUrl = trim((string) ($output['poster_url'] ?? ''));
        $posterFileName = $posterUrl !== '' ? $this->domainService->buildPosterFileName($fileName, $posterUrl) : '';

        $outputPayload = [
            'relative_file_path' => $fileDirExists ? $this->buildRelativeFilePath($relativeFileDir, $fileName) : '',
            'relative_poster_path' => ($fileDirExists && $posterFileName !== '') ? $this->buildRelativeFilePath($relativeFileDir, $posterFileName) : '',
            'poster_file_name' => $posterFileName,
            'provider_video_url' => $videoUrl,
            'provider_poster_url' => $posterUrl,
            'duration_seconds' => $output['duration_seconds'] ?? null,
            'resolution' => (string) ($output['resolution'] ?? ''),
            'fps' => $output['fps'] ?? null,
            // 保存目录 ID 和跳过原因，后续排查目录丢失导致未归档时有明确上下文。
            'file_dir_id' => $taskFileDir?->getFileId() ?? $entity->getOutputDirectoryFileId(),
            'archive_skipped_reason' => $fileDirExists ? '' : 'file_dir_missing',
        ];

        if (! $fileDirExists) {
            $this->logger->info('design video poll mark completed without archive: file dir missing', [
                'video_id' => $entity->getGenerationId(),
                'project_id' => $entity->getProjectId(),
                'operation_id' => $entity->getOperationId(),
                'file_dir_id' => $entity->getOutputDirectoryFileId(),
                'archive_skipped_reason' => $outputPayload['archive_skipped_reason'],
            ]);
            // 视频已由供应商生成成功，目录缺失只跳过归档，仍完成任务以保留计费和供应商输出。
            $this->domainService->markAsCompleted($dataIsolation, $entity, $outputPayload, $fileName);
            $this->logger->info('design video poll completed without archive: file dir missing', [
                'video_id' => $entity->getGenerationId(),
                'project_id' => $entity->getProjectId(),
                'operation_id' => $entity->getOperationId(),
                'status' => $entity->getStatus()->value,
                'archive_skipped_reason' => $outputPayload['archive_skipped_reason'],
            ]);
            return;
        }

        // 目录可能已被用户改名或移动，任务完成时同步为 ID 解析出的最新相对路径。
        $entity->setFileDir($relativeFileDir);
        $uploadPath = substr($fullFileDir, strlen($filePrefix));
        $videoUploadFile = new UploadFile($videoUrl, $uploadPath, $fileName, false);
        $posterUploadFile = $posterUrl !== '' ? new UploadFile($posterUrl, $uploadPath, $posterFileName, false) : null;

        Db::beginTransaction();
        try {
            $videoTaskFile = $this->createProjectFile(
                $dataIsolation,
                $project,
                $taskFileDir->getFileId(),
                rtrim($fullFileDir, '/') . '/' . ltrim($fileName, '/'),
                $fileName,
                $videoUploadFile
            );
            $posterTaskFile = null;
            if ($posterUploadFile !== null) {
                $posterTaskFile = $this->createProjectFile(
                    $dataIsolation,
                    $project,
                    $taskFileDir->getFileId(),
                    rtrim($fullFileDir, '/') . '/' . ltrim($posterFileName, '/'),
                    $posterFileName,
                    $posterUploadFile
                );
            }

            $this->fileDomainService->uploadByCredential($entity->getOrganizationCode(), $videoUploadFile, StorageBucketType::SandBox, false);
            if ($posterUploadFile !== null) {
                $this->fileDomainService->uploadByCredential($entity->getOrganizationCode(), $posterUploadFile, StorageBucketType::SandBox, false);
            }

            $this->domainService->markAsCompleted($dataIsolation, $entity, $outputPayload, $fileName);
            Db::commit();

            $entity->setFileId($videoTaskFile->getFileId());
            $entity->setPosterFileId($posterTaskFile?->getFileId());
        } catch (Throwable $throwable) {
            Db::rollBack();
            throw $throwable;
        }
    }

    /**
     * 优先按创建任务时记录的目录 ID 定位输出目录，避免目录改名后旧路径失效。
     *
     * @return null|array{task_file_dir: TaskFileEntity, full_file_dir: string, relative_file_dir: string}
     */
    private function resolveArchiveDirectory(DesignGenerationTaskEntity $entity, string $filePrefix): ?array
    {
        $workspacePrefix = rtrim(PathFactory::getWorkspacePrefix($filePrefix, $entity->getProjectId()), '/');
        $taskFileDir = null;
        $fileDirId = $entity->getOutputDirectoryFileId();
        if ($fileDirId !== null) {
            $taskFileDir = $this->taskFileDomainService->getById($fileDirId);
        }

        if (! $this->isValidArchiveDirectory($entity, $workspacePrefix, $taskFileDir)) {
            $fullFileDir = PathFactory::buildFullDirPath($filePrefix, $entity->getProjectId(), $entity->getFileDir());
            $taskFileDir = $this->taskFileDomainService->getByFileKey($fullFileDir);
        }

        if (! $this->isValidArchiveDirectory($entity, $workspacePrefix, $taskFileDir)) {
            return null;
        }

        $fullFileDir = rtrim($taskFileDir->getFileKey(), '/') . '/';
        $relativeFileDir = $this->buildNameBasedRelativeDirectoryPath($entity, $taskFileDir);
        if ($relativeFileDir === null) {
            return null;
        }

        return [
            'task_file_dir' => $taskFileDir,
            'full_file_dir' => $fullFileDir,
            'relative_file_dir' => $relativeFileDir,
        ];
    }

    private function buildNameBasedRelativeDirectoryPath(
        DesignGenerationTaskEntity $entity,
        TaskFileEntity $taskFileDir,
    ): ?string {
        $segments = [];
        $visitedFileIds = [];
        $current = $taskFileDir;

        for ($depth = 0; $depth < 100; ++$depth) {
            if ($current->getProjectId() !== $entity->getProjectId()) {
                return null;
            }

            $fileId = $current->getFileId();
            if (isset($visitedFileIds[$fileId])) {
                return null;
            }
            $visitedFileIds[$fileId] = true;

            $fileName = trim($current->getFileName(), '/');
            if ($fileName !== '') {
                array_unshift($segments, $fileName);
            }

            $parentId = $current->getParentId();
            if ($parentId === null || $parentId <= 0) {
                return $segments === [] ? '/' : '/' . implode('/', $segments);
            }

            $parent = $this->taskFileDomainService->getById($parentId);
            if (! $parent instanceof TaskFileEntity) {
                return null;
            }
            $current = $parent;
        }

        return null;
    }

    private function isValidArchiveDirectory(
        DesignGenerationTaskEntity $entity,
        string $workspacePrefix,
        ?TaskFileEntity $taskFileDir,
    ): bool {
        if (! $taskFileDir || ! $taskFileDir->getIsDirectory() || $taskFileDir->getProjectId() !== $entity->getProjectId()) {
            return false;
        }

        $fileKey = rtrim($taskFileDir->getFileKey(), '/');
        return $fileKey === $workspacePrefix || str_starts_with($fileKey, $workspacePrefix . '/');
    }

    private function handleQueryFailure(
        DesignDataIsolation $dataIsolation,
        DesignGenerationTaskEntity $entity,
        DesignVideoPollMessage $msg,
        Throwable $throwable,
    ): void {
        $publicErrorMessage = trans('design.video_generation.query_failed');
        $this->logger->warning('design video poll query failed', [
            'video_id' => $entity->getGenerationId(),
            'project_id' => $entity->getProjectId(),
            'organization_code' => $entity->getOrganizationCode(),
            'operation_id' => $entity->getOperationId(),
            'provider_task_id' => $entity->getProviderPayload()['provider_task_id'] ?? '',
            'error' => $throwable->getMessage(),
        ]);

        $this->domainService->markPollQueryFailed($dataIsolation, $entity, $publicErrorMessage);

        try {
            $this->producer->produce(new DesignVideoPollDelayPublisher($msg));
        } catch (Throwable $republishThrowable) {
            $this->logger->error('design video poll requeue failed after query error', [
                'video_id' => $entity->getGenerationId(),
                'project_id' => $entity->getProjectId(),
                'organization_code' => $entity->getOrganizationCode(),
                'operation_id' => $entity->getOperationId(),
                'provider_task_id' => $entity->getProviderPayload()['provider_task_id'] ?? '',
                'error' => $republishThrowable->getMessage(),
            ]);
            $this->logger->error('design video poll mark failed', [
                'reason' => 'query_failed_requeue_failed',
                'video_id' => $entity->getGenerationId(),
                'project_id' => $entity->getProjectId(),
                'organization_code' => $entity->getOrganizationCode(),
                'operation_id' => $entity->getOperationId(),
                'provider_task_id' => $entity->getProviderPayload()['provider_task_id'] ?? '',
                'error' => $publicErrorMessage,
                'query_error' => $throwable->getMessage(),
                'requeue_error' => $republishThrowable->getMessage(),
            ]);
            $this->domainService->markAsFailed($dataIsolation, $entity, $publicErrorMessage);
        }
    }

    private function createProjectFile(
        DesignDataIsolation $dataIsolation,
        ProjectEntity $project,
        int $parentId,
        string $fileKey,
        string $fileName,
        UploadFile $uploadFile,
    ): TaskFileEntity {
        $contactDataIsolation = ContactDataIsolation::simpleMake($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId());

        $taskFileEntity = new TaskFileEntity();
        $taskFileEntity->setFileKey($fileKey);
        $taskFileEntity->setSource(TaskFileSource::AI_VIDEO_GENERATION);
        $taskFileEntity->setFileName($fileName);
        $taskFileEntity->setFileType(FileType::SYSTEM_AUTO_UPLOAD->name);
        $taskFileEntity->setFileSize($uploadFile->getSize());
        $taskFileEntity->setIsDirectory(false);
        $taskFileEntity->setParentId($parentId);

        $savedEntity = $this->taskFileDomainService->saveProjectFile(
            dataIsolation: $contactDataIsolation,
            projectEntity: $project,
            taskFileEntity: $taskFileEntity,
            isUpdated: false,
        );
        if (! $savedEntity) {
            ExceptionBuilder::throw(
                DesignErrorCode::ThirdPartyServiceError,
                'design.video_generation.save_project_file_failed',
                ['file_key' => $fileKey]
            );
        }

        return $savedEntity;
    }

    private function buildRelativeFilePath(string $fileDir, string $fileName): string
    {
        return rtrim($fileDir, '/') . '/' . ltrim($fileName, '/');
    }
}

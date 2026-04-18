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
                (string) ($error['message'] ?? 'video generation failed')
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
        $fullFileDir = PathFactory::buildFullDirPath($filePrefix, $entity->getProjectId(), $entity->getFileDir());
        $taskFileDir = $this->taskFileDomainService->getByFileKey($fullFileDir);
        $fileDirExists = $taskFileDir && $taskFileDir->getIsDirectory();

        if (! $fileDirExists) {
            $this->logger->warning('design video poll archive skipped: file dir not found, completing without file archive', [
                'video_id' => $entity->getGenerationId(),
                'project_id' => $entity->getProjectId(),
                'organization_code' => $entity->getOrganizationCode(),
                'file_dir' => $entity->getFileDir(),
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
            'relative_file_path' => $fileDirExists ? $this->buildRelativeFilePath($entity->getFileDir(), $fileName) : '',
            'relative_poster_path' => ($fileDirExists && $posterFileName !== '') ? $this->buildRelativeFilePath($entity->getFileDir(), $posterFileName) : '',
            'poster_file_name' => $posterFileName,
            'provider_video_url' => $videoUrl,
            'provider_poster_url' => $posterUrl,
            'duration_seconds' => $output['duration_seconds'] ?? null,
            'resolution' => (string) ($output['resolution'] ?? ''),
            'fps' => $output['fps'] ?? null,
        ];

        if (! $fileDirExists) {
            $this->domainService->markAsCompleted($dataIsolation, $entity, $outputPayload, $fileName);
            return;
        }

        $uploadPath = substr($fullFileDir, strlen($filePrefix));
        $videoUploadFile = new UploadFile($videoUrl, $uploadPath, $fileName, false);
        $posterUploadFile = $posterUrl !== '' ? new UploadFile($posterUrl, $uploadPath, $posterFileName, false) : null;

        Db::beginTransaction();
        try {
            $videoTaskFile = $this->createProjectFile(
                $dataIsolation,
                $project,
                $taskFileDir->getFileId(),
                PathFactory::buildFullFilePath($filePrefix, $entity->getProjectId(), $entity->getFileDir(), $fileName),
                $fileName,
                $videoUploadFile
            );
            $posterTaskFile = null;
            if ($posterUploadFile !== null) {
                $posterTaskFile = $this->createProjectFile(
                    $dataIsolation,
                    $project,
                    $taskFileDir->getFileId(),
                    PathFactory::buildFullFilePath($filePrefix, $entity->getProjectId(), $entity->getFileDir(), $posterFileName),
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

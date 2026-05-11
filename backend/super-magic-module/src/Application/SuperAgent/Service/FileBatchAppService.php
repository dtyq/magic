<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Application\File\Service\FileAppService;
use App\Application\File\Service\FileBatchStatusManager;
use App\Application\File\Service\FileCleanupAppService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\SuperMagic\Domain\FileCollection\Service\FileCollectionDomainService;
use Dtyq\SuperMagic\Domain\MagicFS\Service\MagicFSFileDomainService;
use Dtyq\SuperMagic\Domain\Share\Constant\ResourceType;
use Dtyq\SuperMagic\Domain\Share\Service\ResourceShareDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\AgentDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\BatchDownloadPackDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\ErrorCode\ShareErrorCode;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\FileConverter\Request\FileConverterRequest;
use Dtyq\SuperMagic\Infrastructure\Utils\AccessTokenUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateBatchDownloadRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\CheckBatchDownloadResponseDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\CreateBatchDownloadResponseDTO;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

class FileBatchAppService extends AbstractAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        protected FileAppService $fileAppService,
        protected TopicDomainService $topicDomainService,
        protected ProjectDomainService $projectDomainService,
        protected TaskFileDomainService $taskFileDomainService,
        protected FileBatchStatusManager $statusManager,
        protected ResourceShareDomainService $resourceShareDomainService,
        protected FileCollectionDomainService $fileCollectionDomainService,
        protected BatchDownloadPackDomainService $batchDownloadPackDomainService,
        protected AgentDomainService $agentDomainService,
        protected MagicFSFileDomainService $magicFSFileDomainService,
        protected FileCleanupAppService $fileCleanupAppService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * Create batch download task.
     *
     * @param RequestContext $requestContext Request context
     * @param CreateBatchDownloadRequestDTO $requestDTO Request DTO
     * @return CreateBatchDownloadResponseDTO Create result
     * @throws BusinessException If files not found or access denied
     */
    public function createBatchDownload(
        RequestContext $requestContext,
        CreateBatchDownloadRequestDTO $requestDTO
    ): CreateBatchDownloadResponseDTO {
        $userAuthorization = $requestContext->getUserAuthorization();
        $userId = $userAuthorization->getId();
        $fileIds = $requestDTO->getFileIds();

        if (count($fileIds) > 1000) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_TOO_MANY_FILES);
        }

        $projectEntity = $this->getAccessibleProject((int) $requestDTO->getProjectId(), $userId, $userAuthorization->getOrganizationCode());

        if (! empty($fileIds)) {
            $selectedEntities = $this->taskFileDomainService->findFilesByProjectIdAndIds($projectEntity->getId(), $fileIds);
        } else {
            $selectedEntities = $this->taskFileDomainService->findUserFilesByProjectId($requestDTO->getProjectId());
        }

        if (empty($selectedEntities)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_NO_VALID_FILES);
        }

        $expandedEntities = $this->expandSelectionToEntities($selectedEntities, $projectEntity->getId());
        $packManifest = $this->buildAuthorizedPackManifest(
            $selectedEntities,
            $expandedEntities,
            null,
            $projectEntity
        );

        $leafFiles = $packManifest['leaf_files'];
        if (empty($leafFiles)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_NO_VALID_FILES);
        }

        if (count($leafFiles) > 10000) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_TOO_MANY_FILES);
        }

        $pathMode = 'relative';
        $actualFileIds = $packManifest['unique_leaf_file_ids'];
        $batchKey = $this->generateBatchKey($actualFileIds, $userId, $requestDTO->getProjectId(), $pathMode);

        $cachedResponse = $this->handleCachedBatchTask($batchKey, $leafFiles);
        if ($cachedResponse !== null) {
            return $cachedResponse;
        }

        $targetName = sprintf('%s_%s.zip', $projectEntity->getProjectName(), date('YmdHi'));
        $organizationCode = $projectEntity->getUserOrganizationCode();
        $sandboxId = $this->generateBatchPackSandboxId($projectEntity->getId());

        $this->statusManager->initializeTask($batchKey, $userId, count($leafFiles), $organizationCode, [
            'sandbox_id' => $sandboxId,
            'project_id' => (string) $projectEntity->getId(),
            'task_key' => $batchKey,
            'zip_bucket_type' => StorageBucketType::Private->value,
            'target_name' => $targetName,
        ]);

        $this->prepareAndSubmitSandboxPackTask(
            $batchKey,
            $userAuthorization->getId(),
            $organizationCode,
            $projectEntity,
            $packManifest,
            $targetName,
            $sandboxId
        );

        return new CreateBatchDownloadResponseDTO(
            'processing',
            $batchKey,
            null,
            count($leafFiles),
            'Processing, please check status later'
        );
    }

    /**
     * Create batch download task by access token.
     *
     * @param RequestContext $requestContext Request context
     * @param CreateBatchDownloadRequestDTO $requestDTO Request DTO
     * @return CreateBatchDownloadResponseDTO Create result
     * @throws BusinessException If validation failed
     */
    public function createBatchDownloadByToken(
        RequestContext $requestContext,
        CreateBatchDownloadRequestDTO $requestDTO
    ): CreateBatchDownloadResponseDTO {
        $token = $requestDTO->getToken();
        $fileIds = $requestDTO->getFileIds();

        if (empty($token)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'token_required');
        }

        if (count($fileIds) > 1000) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_TOO_MANY_FILES);
        }

        if (! AccessTokenUtil::validate($token)) {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied, 'task_file.access_denied');
        }

        $shareId = AccessTokenUtil::getShareId($token);
        $shareEntity = $this->resourceShareDomainService->getValidShareById($shareId);
        if (! $shareEntity) {
            ExceptionBuilder::throw(ShareErrorCode::RESOURCE_NOT_FOUND, 'share.resource_not_found');
        }

        $projectId = 0;
        $allowedFileIds = null;
        switch ($shareEntity->getResourceType()) {
            case ResourceType::Topic->value:
                $topicEntity = $this->topicDomainService->getTopicWithDeleted((int) $shareEntity->getResourceId());
                if (empty($topicEntity)) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
                }
                $projectId = $topicEntity->getProjectId();
                break;
            case ResourceType::Project->value:
                $projectId = (int) $shareEntity->getProjectId();
                break;
            case ResourceType::FileCollection->value:
            case ResourceType::File->value:
                $collectionId = (int) $shareEntity->getResourceId();
                $projectId = $this->fileCollectionDomainService->getProjectIdByCollectionId($collectionId);
                if (empty($projectId)) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, 'file.file_collection_empty_or_not_found');
                }
                $allowedFileIds = $this->getAllowedFileIdsFromCollection($collectionId, $projectId);
                break;
            default:
                ExceptionBuilder::throw(ShareErrorCode::RESOURCE_TYPE_NOT_SUPPORTED, 'share.resource_type_not_supported');
        }

        $projectEntity = $this->projectDomainService->getProjectNotUserId($projectId);
        if (empty($projectEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND);
        }

        $selectedEntities = $this->taskFileDomainService->findFilesByProjectIdAndIds($projectId, $fileIds);
        if (empty($selectedEntities)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_NO_VALID_FILES);
        }

        $expandedEntities = $this->expandSelectionToEntities($selectedEntities, $projectId);
        $packManifest = $this->buildAuthorizedPackManifest(
            $selectedEntities,
            $expandedEntities,
            $allowedFileIds,
            $projectEntity
        );

        $leafFiles = $packManifest['leaf_files'];
        if (empty($leafFiles)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_NO_VALID_FILES);
        }

        if (count($leafFiles) > 10000) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_TOO_MANY_FILES);
        }

        $pathMode = 'relative';
        $userAuthorization = $requestContext->getUserAuthorization();
        $userId = $userAuthorization->getId();

        $actualFileIds = $packManifest['unique_leaf_file_ids'];
        $batchKey = $this->generateBatchKey($actualFileIds, $userId, (string) $projectId, $pathMode);

        $cachedResponse = $this->handleCachedBatchTask($batchKey, $leafFiles);
        if ($cachedResponse !== null) {
            return $cachedResponse;
        }

        $targetName = sprintf('%s_%s.zip', $projectEntity->getProjectName(), date('YmdHi'));
        $organizationCode = $projectEntity->getUserOrganizationCode();
        $sandboxId = $this->generateBatchPackSandboxId($projectEntity->getId());

        $this->statusManager->initializeTask($batchKey, $userId, count($leafFiles), $organizationCode, [
            'sandbox_id' => $sandboxId,
            'project_id' => (string) $projectEntity->getId(),
            'task_key' => $batchKey,
            'zip_bucket_type' => StorageBucketType::Private->value,
            'target_name' => $targetName,
        ]);

        $this->prepareAndSubmitSandboxPackTask(
            $batchKey,
            $userId,
            $organizationCode,
            $projectEntity,
            $packManifest,
            $targetName,
            $sandboxId
        );

        return new CreateBatchDownloadResponseDTO(
            'processing',
            $batchKey,
            null,
            count($leafFiles),
            'Processing, please check status later'
        );
    }

    /**
     * Check batch download status.
     *
     * @param RequestContext $requestContext Request context
     * @param string $batchKey Batch key
     * @return CheckBatchDownloadResponseDTO Query result
     * @throws BusinessException If access denied
     */
    public function checkBatchDownload(
        RequestContext $requestContext,
        string $batchKey
    ): CheckBatchDownloadResponseDTO {
        // Get user authorization info
        $userAuthorization = $requestContext->getUserAuthorization();
        $userId = $userAuthorization->getId();

        // Permission check
        if (! $this->statusManager->verifyUserPermission($batchKey, $userId)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_ACCESS_DENIED);
        }

        // Get task status
        $taskStatus = $this->statusManager->getTaskStatus($batchKey);

        if (! $taskStatus) {
            return new CheckBatchDownloadResponseDTO(
                'processing',
                null,
                0,
                'Task not found or expired'
            );
        }

        $status = $taskStatus['status'] ?? 'processing';

        if ($status === 'ready' || $status === 'failed') {
            return $this->buildBatchDownloadResponse($taskStatus, $userAuthorization->getOrganizationCode());
        }

        $organizationCode = (string) ($taskStatus['organization_code'] ?? $userAuthorization->getOrganizationCode());
        $this->syncTaskStatusFromSandbox($batchKey, $taskStatus, $organizationCode);
        $taskStatus = $this->statusManager->getTaskStatus($batchKey) ?? $taskStatus;

        $this->logger->info('Check batch download status', [
            'batch_key' => $batchKey,
            'status' => $taskStatus['status'] ?? 'processing',
            'organization_code' => $organizationCode,
            'user_id' => $userId,
        ]);

        return $this->buildBatchDownloadResponse($taskStatus, $organizationCode);
    }

    /**
     * @param TaskFileEntity[] $userFiles
     */
    private function handleCachedBatchTask(string $batchKey, array $userFiles): ?CreateBatchDownloadResponseDTO
    {
        $taskStatus = $this->statusManager->getTaskStatus($batchKey);
        if (! $taskStatus) {
            return null;
        }

        $status = $taskStatus['status'] ?? '';
        if ($status === 'ready') {
            $latestFileUpdateTime = $this->getLatestFileUpdateTime($userFiles);
            $cacheUpdatedAt = (int) ($taskStatus['updated_at'] ?? 0);

            if ($latestFileUpdateTime > $cacheUpdatedAt) {
                $this->statusManager->cleanupTask($batchKey);
                return null;
            }

            $downloadUrl = (string) ($taskStatus['result']['download_url'] ?? '');
            if ($downloadUrl === '') {
                $zipFileKey = (string) ($taskStatus['result']['zip_file_key'] ?? '');
                $organizationCode = (string) ($taskStatus['organization_code'] ?? '');
                if ($zipFileKey !== '' && $organizationCode !== '') {
                    $bucketType = $this->resolveZipBucketType($taskStatus);
                    $downloadUrl = $this->generateDownloadUrl(
                        $zipFileKey,
                        $organizationCode,
                        $bucketType
                    );
                }
            }

            return new CreateBatchDownloadResponseDTO(
                'ready',
                $batchKey,
                $downloadUrl,
                (int) ($taskStatus['result']['file_count'] ?? count($userFiles)),
                'Files are ready'
            );
        }

        if ($status === 'processing') {
            return new CreateBatchDownloadResponseDTO(
                'processing',
                $batchKey,
                null,
                (int) ($taskStatus['progress']['total'] ?? count($userFiles)),
                'Processing, please check status later'
            );
        }

        if ($status === 'failed') {
            $this->statusManager->cleanupTask($batchKey);
        }

        return null;
    }

    /**
     * Generate batch key.
     *
     * @param array $fileIds File ID array
     * @param string $userId User ID
     * @param string $projectId Project ID
     * @param string $pathMode Path mode (absolute or relative)
     * @return string Batch key
     */
    private function generateBatchKey(array $fileIds, string $userId, string $projectId, string $pathMode = 'absolute'): string
    {
        sort($fileIds);
        $data = implode(',', $fileIds) . '|' . $userId . '|' . $projectId . '|' . $pathMode;
        return 'batch_' . md5($data);
    }

    /**
     * @param array{
     *   base_path:string,
     *   relative_base_path:string,
     *   pack_entries:array<int,string>,
     *   leaf_files:array<int,TaskFileEntity>,
     *   unique_leaf_file_ids:array<int,int>
     * } $packManifest
     */
    private function prepareAndSubmitSandboxPackTask(
        string $batchKey,
        string $userId,
        string $organizationCode,
        ProjectEntity $projectEntity,
        array $packManifest,
        string $targetName,
        string $sandboxId
    ): void {
        if (! $this->statusManager->acquireLock($batchKey)) {
            return;
        }

        try {
            $projectWorkDir = $projectEntity->getWorkDir();
            $fullPrefix = $this->taskFileDomainService->getFullPrefix($organizationCode);

            if (empty($packManifest['pack_entries'])) {
                ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_NO_VALID_FILES);
            }

            $fullBaseWorkDir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $packManifest['base_path']);

            $rootFileId = '';
            try {
                $rootFileId = (string) $this->taskFileDomainService->getProjectRootFileId($projectEntity->getId());
            } catch (Throwable $e) {
                $this->logger->warning('Failed to get root_file_id for batch pack', [
                    'batch_key' => $batchKey,
                    'project_id' => $projectEntity->getId(),
                    'error' => $e->getMessage(),
                ]);
            }

            $topicId = '';
            if (! empty($packManifest['leaf_files']) && $packManifest['leaf_files'][0]->getTopicId() > 0) {
                $topicId = (string) $packManifest['leaf_files'][0]->getTopicId();
            }

            $authorization = $this->agentDomainService->getAuthorizationByUserId($userId);
            $stsTemporaryCredential = $this->getStsCredential($organizationCode, $projectWorkDir);

            $request = new FileConverterRequest(
                $sandboxId,
                'pack',
                $packManifest['pack_entries'],
                $stsTemporaryCredential,
                [],
                $batchKey,
                $userId,
                $organizationCode,
                $topicId,
                $rootFileId,
                $authorization,
                $targetName
            );

            $response = $this->batchDownloadPackDomainService->submitPackTask(
                $userId,
                $organizationCode,
                $sandboxId,
                (string) $projectEntity->getId(),
                $request,
                $fullBaseWorkDir
            );

            if (! $response->isSuccess()) {
                ExceptionBuilder::throw(
                    SuperAgentErrorCode::BATCH_PUBLISH_FAILED,
                    'sandbox_pack_submit_failed: ' . $response->getMessage()
                );
            }

            $this->logger->info('Batch pack task submitted to sandbox', [
                'batch_key' => $batchKey,
                'sandbox_id' => $sandboxId,
                'project_id' => $projectEntity->getId(),
                'file_count' => count($packManifest['pack_entries']),
                'target_name' => $targetName,
                'base_path' => $packManifest['base_path'],
                'relative_base_path' => $packManifest['relative_base_path'],
            ]);
        } catch (BusinessException $e) {
            $this->statusManager->setTaskFailed($batchKey, $e->getMessage());
            throw $e;
        } catch (Throwable $e) {
            $this->statusManager->setTaskFailed($batchKey, $e->getMessage());
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_PUBLISH_FAILED, $e->getMessage());
        }
    }

    private function syncTaskStatusFromSandbox(string $batchKey, array $taskStatus, string $organizationCode): void
    {
        $sandboxId = (string) ($taskStatus['sandbox_id'] ?? '');
        $projectId = (string) ($taskStatus['project_id'] ?? '');
        $taskKey = (string) ($taskStatus['task_key'] ?? '');

        if ($sandboxId === '' || $projectId === '' || $taskKey === '') {
            $this->statusManager->setTaskFailed($batchKey, 'Batch task context is incomplete');
            $this->logger->warning('Batch task context is incomplete for sandbox sync', [
                'batch_key' => $batchKey,
                'sandbox_id' => $sandboxId,
                'project_id' => $projectId,
                'task_key' => $taskKey,
            ]);
            return;
        }

        try {
            $response = $this->batchDownloadPackDomainService->queryPackTask($sandboxId, $projectId, $taskKey);
        } catch (Throwable $e) {
            $this->logger->error('Query sandbox pack status failed', [
                'batch_key' => $batchKey,
                'sandbox_id' => $sandboxId,
                'project_id' => $projectId,
                'task_key' => $taskKey,
                'error' => $e->getMessage(),
            ]);
            return;
        }

        if (! $response->isSuccess()) {
            $this->logger->warning('Sandbox pack status query returned unsuccessful response', [
                'batch_key' => $batchKey,
                'sandbox_id' => $sandboxId,
                'project_id' => $projectId,
                'task_key' => $taskKey,
                'code' => $response->getCode(),
                'message' => $response->getMessage(),
            ]);
            return;
        }

        $mappedStatus = $this->batchDownloadPackDomainService->mapSandboxStatus($response);
        $status = (string) ($mappedStatus['status'] ?? 'processing');

        if ($status === 'processing') {
            $total = (int) ($taskStatus['progress']['total'] ?? 0);
            if ($total <= 0) {
                $total = max(1, (int) ($mappedStatus['file_count'] ?? 1));
            }

            $progressPercent = (int) ($mappedStatus['progress'] ?? 0);
            $progressPercent = max(0, min(100, $progressPercent));
            $current = (int) floor($total * ($progressPercent / 100));

            $this->statusManager->setTaskProgress(
                $batchKey,
                $current,
                $total,
                (string) ($mappedStatus['message'] ?? 'Processing...')
            );
            return;
        }

        if ($status === 'failed') {
            $this->statusManager->setTaskFailed(
                $batchKey,
                (string) ($mappedStatus['error'] ?: $mappedStatus['message'] ?: 'Task failed')
            );
            return;
        }

        if ($status !== 'ready') {
            return;
        }

        $zipFileKey = trim((string) ($mappedStatus['zip_file_key'] ?? ''));
        if ($zipFileKey === '') {
            $this->statusManager->setTaskFailed($batchKey, 'Sandbox pack completed but zip file key is empty');
            return;
        }

        $bucketType = $this->resolveZipBucketType($taskStatus);
        $downloadUrl = $this->generateDownloadUrl($zipFileKey, $organizationCode, $bucketType);
        $zipFileName = trim((string) ($mappedStatus['zip_file_name'] ?? ''));
        if ($zipFileName === '') {
            $zipFileName = basename($zipFileKey);
        }

        $result = [
            'download_url' => $downloadUrl,
            'zip_file_key' => $zipFileKey,
            'zip_file_name' => $zipFileName,
            'zip_bucket_type' => $bucketType->value,
            'file_count' => (int) ($mappedStatus['file_count'] ?? ($taskStatus['progress']['total'] ?? 0)),
        ];

        if ($this->statusManager->setTaskCompleted($batchKey, $result)) {
            $this->registerZipFileForCleanup(
                $organizationCode,
                $zipFileKey,
                $zipFileName,
                $batchKey,
                $bucketType
            );
        }
    }

    private function buildBatchDownloadResponse(
        array $taskStatus,
        string $organizationCode
    ): CheckBatchDownloadResponseDTO {
        $status = (string) ($taskStatus['status'] ?? 'processing');
        $progress = $taskStatus['progress'] ?? [];
        $result = $taskStatus['result'] ?? [];
        $error = (string) ($taskStatus['error'] ?? '');

        switch ($status) {
            case 'ready':
                $downloadUrl = (string) ($result['download_url'] ?? '');
                if ($downloadUrl === '') {
                    $fileKey = (string) ($result['zip_file_key'] ?? '');
                    if ($fileKey !== '') {
                        $bucketType = StorageBucketType::tryFrom((string) ($result['zip_bucket_type'] ?? StorageBucketType::Private->value))
                            ?? StorageBucketType::Private;
                        $downloadUrl = $this->generateDownloadUrl($fileKey, $organizationCode, $bucketType);
                    }
                }

                return new CheckBatchDownloadResponseDTO(
                    'ready',
                    $downloadUrl,
                    100,
                    'Files are ready'
                );

            case 'failed':
                return new CheckBatchDownloadResponseDTO(
                    'failed',
                    null,
                    null,
                    $error !== '' ? $error : 'Task failed'
                );

            case 'processing':
            default:
                return new CheckBatchDownloadResponseDTO(
                    'processing',
                    null,
                    (int) ($progress['percentage'] ?? 0),
                    (string) ($progress['message'] ?? 'Processing...')
                );
        }
    }

    /**
     * Generate download URL.
     *
     * @param string $filePath File path
     * @param string $organizationCode Organization code
     * @return string Download URL
     */
    private function generateDownloadUrl(
        string $filePath,
        string $organizationCode,
        StorageBucketType $bucketType = StorageBucketType::SandBox
    ): string {
        $fileLink = $this->fileAppService->getLink($organizationCode, $filePath, $bucketType, []);
        if (empty($fileLink)) {
            return '';
        }
        return $fileLink->getUrl();
    }

    private function resolveZipBucketType(array $taskStatus): StorageBucketType
    {
        $bucketType = (string) ($taskStatus['zip_bucket_type'] ?? ($taskStatus['result']['zip_bucket_type'] ?? StorageBucketType::Private->value));
        return StorageBucketType::tryFrom($bucketType) ?? StorageBucketType::Private;
    }

    private function registerZipFileForCleanup(
        string $organizationCode,
        string $zipFileKey,
        string $zipFileName,
        string $batchKey,
        StorageBucketType $bucketType
    ): void {
        $fileName = $zipFileName !== '' ? $zipFileName : basename($zipFileKey);
        $registered = $this->fileCleanupAppService->registerFileForCleanup(
            $organizationCode,
            $zipFileKey,
            $fileName,
            0,
            'batch_compress',
            $batchKey,
            7200,
            $bucketType->value
        );

        if (! $registered) {
            $this->logger->warning('Register zip file cleanup failed', [
                'batch_key' => $batchKey,
                'organization_code' => $organizationCode,
                'zip_file_key' => $zipFileKey,
                'bucket_type' => $bucketType->value,
            ]);
        }
    }

    private function generateBatchPackSandboxId(int $projectId): string
    {
        return WorkDirectoryUtil::generateUniqueCodeFromSnowflakeId($projectId . '_batch_pack');
    }

    private function generateTempDir(string $workDir): string
    {
        $workDir = rtrim($workDir, '/');
        $pathParts = explode('/', $workDir);
        if (count($pathParts) >= 3) {
            return '/' . $pathParts[1] . '/' . $pathParts[2] . '/temp';
        }
        return '/temp';
    }

    private function getStsCredential(string $organizationCode, string $workDir): array
    {
        return $this->fileAppService->getStsTemporaryCredentialV2(
            $organizationCode,
            StorageBucketType::Private->value,
            $this->generateTempDir($workDir)
        );
    }

    /**
     * Get the latest file update time from user files.
     *
     * @param array $userFiles Array of TaskFileEntity objects
     * @return int Latest update timestamp (0 if no files or no update time)
     */
    private function getLatestFileUpdateTime(array $userFiles): int
    {
        $latestTimestamp = 0;

        /** @var TaskFileEntity $file */
        foreach ($userFiles as $file) {
            $updateTime = $file->getUpdatedAt();

            if (! empty($updateTime)) {
                // Convert Y-m-d H:i:s format to timestamp
                $timestamp = strtotime($updateTime);
                if ($timestamp > $latestTimestamp) {
                    $latestTimestamp = $timestamp;
                }
            }
        }

        return $latestTimestamp;
    }

    /**
     * @param TaskFileEntity[] $selectedEntities
     * @param TaskFileEntity[] $expandedEntities
     * @param null|int[] $allowedFileIds
     * @return array{
     *   base_path:string,
     *   relative_base_path:string,
     *   pack_entries:array<int,string>,
     *   leaf_files:array<int,TaskFileEntity>,
     *   unique_leaf_file_ids:array<int,int>
     * }
     */
    private function buildAuthorizedPackManifest(
        array $selectedEntities,
        array $expandedEntities,
        ?array $allowedFileIds,
        ProjectEntity $projectEntity
    ): array {
        $authorizedEntities = $this->filterAuthorizedEntities($expandedEntities, $allowedFileIds);
        if (empty($authorizedEntities)) {
            return [
                'base_path' => $projectEntity->getWorkDir(),
                'relative_base_path' => '',
                'pack_entries' => [],
                'leaf_files' => [],
                'unique_leaf_file_ids' => [],
            ];
        }

        $fullPrefix = $this->taskFileDomainService->getFullPrefix($projectEntity->getUserOrganizationCode());
        $fullProjectWorkDir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $projectEntity->getWorkDir());

        return $this->batchDownloadPackDomainService->buildPackManifest(
            $selectedEntities,
            $authorizedEntities,
            $projectEntity->getId(),
            $projectEntity->getWorkDir(),
            $fullProjectWorkDir
        );
    }

    /**
     * Expand selection into a full candidate tree (directories + files).
     *
     * @param TaskFileEntity[] $entities
     * @return TaskFileEntity[]
     */
    private function expandSelectionToEntities(array $entities, int $projectId): array
    {
        $entityMap = [];

        /** @var TaskFileEntity $entity */
        foreach ($entities as $entity) {
            $entityMap[$entity->getFileId()] = $entity;

            if (! $entity->getIsDirectory()) {
                continue;
            }

            $subtreeFileIds = $this->collectSubtreeFileIdsByMagicFs($entity->getFileId());
            if (empty($subtreeFileIds)) {
                continue;
            }

            $subtreeEntities = $this->taskFileDomainService->findFilesByProjectIdAndIds($projectId, $subtreeFileIds);
            foreach ($subtreeEntities as $subtreeEntity) {
                $entityMap[$subtreeEntity->getFileId()] = $subtreeEntity;
            }
        }

        return array_values($entityMap);
    }

    /**
     * @param TaskFileEntity[] $entities
     * @param null|int[] $allowedFileIds
     * @return TaskFileEntity[]
     */
    private function filterAuthorizedEntities(array $entities, ?array $allowedFileIds): array
    {
        if ($allowedFileIds === null) {
            return $entities;
        }

        $allowedFileIdMap = array_fill_keys($allowedFileIds, true);

        return array_values(array_filter(
            $entities,
            static fn (TaskFileEntity $entity): bool => isset($allowedFileIdMap[$entity->getFileId()])
        ));
    }

    /**
     * @return int[]
     */
    private function collectSubtreeFileIdsByMagicFs(int $fileId): array
    {
        try {
            $fileTree = $this->magicFSFileDomainService->getFileTree((string) $fileId);
        } catch (Throwable $e) {
            $this->logger->error('Collect subtree file ids by MagicFS failed', [
                'file_id' => $fileId,
                'error' => $e->getMessage(),
            ]);
            return [];
        }

        $fileIds = [];
        if (isset($fileTree['root']) && $fileTree['root'] instanceof TaskFileEntity) {
            $fileIds[] = $fileTree['root']->getFileId();
        }

        if (isset($fileTree['children']) && is_array($fileTree['children'])) {
            foreach ($fileTree['children'] as $childEntity) {
                if ($childEntity instanceof TaskFileEntity) {
                    $fileIds[] = $childEntity->getFileId();
                }
            }
        }

        return array_values(array_unique($fileIds));
    }

    /**
     * Get all allowed file IDs from a file collection.
     * This includes files directly in the collection AND all child files of directories in the collection.
     *
     * @param int $collectionId File collection ID
     * @param int $projectId Project ID
     * @return array Array of allowed file IDs
     */
    private function getAllowedFileIdsFromCollection(int $collectionId, int $projectId): array
    {
        // Get files directly shared in the collection
        $collectionItems = $this->fileCollectionDomainService->getFilesByCollectionId($collectionId);
        if (empty($collectionItems)) {
            return [];
        }

        // Extract file IDs from collection items
        $sharedFileIds = array_map(fn ($item) => (int) $item->getFileId(), $collectionItems);

        // Get file entities to check which ones are directories
        $sharedEntities = $this->taskFileDomainService->findFilesByProjectIdAndIds($projectId, $sharedFileIds);

        $allowedFileIds = [];
        $sharedDirectoryIds = [];
        foreach ($sharedEntities as $entity) {
            $fileId = $entity->getFileId();
            $allowedFileIds[] = $fileId;

            if ($entity->getIsDirectory()) {
                $sharedDirectoryIds[] = $fileId;
            }
        }

        foreach ($sharedDirectoryIds as $directoryId) {
            $allowedFileIds = array_merge($allowedFileIds, $this->collectSubtreeFileIdsByMagicFs($directoryId));
        }

        return array_values(array_unique($allowedFileIds));
    }
}

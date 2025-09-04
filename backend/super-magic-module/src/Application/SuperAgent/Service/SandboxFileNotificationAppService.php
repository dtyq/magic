<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Locker\LockerInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageMetadata;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\SandboxFileNotificationDataValueObject;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileContentSavedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileUploadedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\SandboxFileNotificationRequestDTO;
use Hyperf\Logger\LoggerFactory;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Sandbox file notification application service.
 */
class SandboxFileNotificationAppService extends AbstractAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        protected TaskDomainService $taskDomainService,
        protected TaskFileDomainService $taskFileDomainService,
        protected ProjectDomainService $projectDomainService,
        protected LockerInterface $locker,
        protected readonly EventDispatcherInterface $eventDispatcher,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * Handle sandbox file notification without user authentication (token-based).
     * This method creates DataIsolation context from metadata instead of request context.
     *
     * @param SandboxFileNotificationRequestDTO $requestDTO Request DTO
     * @return array Response data
     */
    public function handleNotificationWithoutAuth(SandboxFileNotificationRequestDTO $requestDTO): array
    {
        // 1. Get metadata and data value objects
        $metadata = $requestDTO->getMetadataValueObject();
        $data = $requestDTO->getDataValueObject();

        // 2. Validate operation type
        if (! $data->isValidOperation()) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'Invalid operation type');
        }

        // 3. Create DataIsolation context from metadata
        $dataIsolation = $this->createDataIsolationFromMetadata($metadata);

        // 4. Get project information
        $projectEntity = $this->getProjectEntity($metadata);

        // 5. Build complete file key
        $fileKey = $this->buildFileKey($metadata, $data, $projectEntity->getWorkDir());

        // 6. Setup spin lock for file_key to prevent concurrent processing
        $lockKey = WorkDirectoryUtil::getLockerKey($projectEntity->getId());
        $lockOwner = $dataIsolation->getCurrentUserId();
        $lockExpireSeconds = 30;
        $lockAcquired = false;

        try {
            // Attempt to acquire distributed spin lock
            $lockAcquired = $this->locker->spinLock($lockKey, $lockOwner, $lockExpireSeconds);
            if (! $lockAcquired) {
                $this->logger->warning(sprintf(
                    'Failed to acquire lock for file_key processing: %s, operation: %s, project_id: %d',
                    $fileKey,
                    $data->getOperation(),
                    $projectEntity->getId()
                ));
                ExceptionBuilder::throw(GenericErrorCode::SystemError, 'Failed to acquire file processing lock');
            }

            $this->logger->info(sprintf(
                'Lock acquired for file_key processing: %s, operation: %s, project_id: %d',
                $fileKey,
                $data->getOperation(),
                $projectEntity->getId()
            ));

            // 7. Handle file operation based on type
            $taskFileEntity = null;
            switch ($data->getOperation()) {
                case 'CREATE':
                case 'UPDATE':
                    $result = $this->handleCreateOrUpdateFile($dataIsolation, $metadata, $data, $projectEntity, $fileKey);
                    $taskFileEntity = $this->taskFileDomainService->getByFileKey($fileKey);
                    break;
                case 'DELETE':
                    $taskFileEntity = $this->taskFileDomainService->getByFileKey($fileKey);
                    $result = $this->handleDeleteFile($dataIsolation, $fileKey);
                    break;
                default:
                    ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'Unsupported operation');
            }

            // Dispatch file operation event
            if ($taskFileEntity) {
                $this->dispatchFileOperationEvent($dataIsolation, $data, $taskFileEntity);
            }

            $this->logger->info(sprintf(
                'File_key processed successfully with lock protection: %s, operation: %s, project_id: %d',
                $fileKey,
                $data->getOperation(),
                $projectEntity->getId()
            ));

            return $result;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'Exception processing file_key with lock protection: %s, operation: %s, project_id: %d, error: %s',
                $fileKey,
                $data->getOperation(),
                $projectEntity->getId(),
                $e->getMessage()
            ));
            throw $e;
        } finally {
            // Ensure lock is always released
            if ($lockAcquired) {
                if ($this->locker->release($lockKey, $lockOwner)) {
                    $this->logger->debug(sprintf(
                        'Lock released for file_key processing: %s, operation: %s, project_id: %d',
                        $fileKey,
                        $data->getOperation(),
                        $projectEntity->getId()
                    ));
                } else {
                    $this->logger->error(sprintf(
                        'Failed to release lock for file_key processing: %s, operation: %s, project_id: %d. Manual intervention may be required.',
                        $fileKey,
                        $data->getOperation(),
                        $projectEntity->getId()
                    ));
                }
            }
        }
    }

    /**
     * Get project entity from metadata without permission check.
     * Used for token-based authentication where user context is not available.
     *
     * @param MessageMetadata $metadata Message metadata
     * @return ProjectEntity
     */
    private function getProjectEntity(MessageMetadata $metadata)
    {
        $taskEntity = $this->taskDomainService->getTaskById((int) $metadata->getSuperMagicTaskId());
        if (! $taskEntity) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TASK_NOT_FOUND, 'Task not found');
        }

        $projectId = $taskEntity->getProjectId();
        if (empty($projectId)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'Project ID not found in metadata');
        }

        return $this->getAccessibleProject((int) $projectId, $metadata->getUserId(), $metadata->getOrganizationCode());
    }

    /**
     * Create DataIsolation context from metadata.
     * Used when user context is not available from request.
     *
     * @param MessageMetadata $metadata Message metadata
     * @return DataIsolation Data isolation context
     */
    private function createDataIsolationFromMetadata(MessageMetadata $metadata): DataIsolation
    {
        $userId = $metadata->getUserId();
        $organizationCode = $metadata->getOrganizationCode();

        if (empty($userId) || empty($organizationCode)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'User ID and organization code are required in metadata');
        }

        return new DataIsolation([
            'current_user_id' => $userId,
            'current_organization_code' => $organizationCode,
        ]);
    }

    /**
     * Build complete file key.
     *
     * @param MessageMetadata $metadata Message metadata
     * @param SandboxFileNotificationDataValueObject $data File data
     * @param string $workDir Project work directory
     * @return string Complete file key
     */
    private function buildFileKey(
        MessageMetadata $metadata,
        SandboxFileNotificationDataValueObject $data,
        string $workDir
    ): string {
        $organizationCode = $metadata->getOrganizationCode();
        $filePath = $data->getFilePath();
        if (WorkDirectoryUtil::isValidDirectoryName($filePath)) {
            $filePath = rtrim($filePath, '/') . '/';
        }
        $fullPrefix = $this->taskFileDomainService->getFullPrefix($organizationCode);

        return WorkDirectoryUtil::getFullFileKey($fullPrefix, $workDir, $filePath);
    }

    /**
     * Handle create or update file operation.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param MessageMetadata $metadata Message metadata
     * @param SandboxFileNotificationDataValueObject $data File data
     * @param ProjectEntity $projectEntity Project entity
     * @param string $fileKey Complete file key
     * @return array Response data
     */
    private function handleCreateOrUpdateFile(
        DataIsolation $dataIsolation,
        MessageMetadata $metadata,
        SandboxFileNotificationDataValueObject $data,
        ProjectEntity $projectEntity,
        string $fileKey
    ): array {
        // Delegate to domain service
        $taskFileEntity = $this->taskFileDomainService->handleSandboxFileNotification(
            $dataIsolation,
            $projectEntity,
            $fileKey,
            $data,
            $metadata
        );
        return [
            'file_id' => $taskFileEntity->getFileId(),
            'operation' => $data->getOperation(),
            'success' => true,
        ];
    }

    /**
     * Handle delete file operation.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param string $fileKey Complete file key
     * @return array Response data
     */
    private function handleDeleteFile(DataIsolation $dataIsolation, string $fileKey): array
    {
        // Delegate to domain service
        $deleted = $this->taskFileDomainService->handleSandboxFileDelete($dataIsolation, $fileKey);

        return [
            'operation' => 'DELETE',
            'success' => $deleted,
        ];
    }

    /**
     * Dispatch file operation event based on operation type.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param SandboxFileNotificationDataValueObject $data File data
     * @param mixed $taskFileEntity Task file entity (can be null)
     */
    private function dispatchFileOperationEvent(
        DataIsolation $dataIsolation,
        SandboxFileNotificationDataValueObject $data,
        $taskFileEntity
    ): void {
        if (! $taskFileEntity) {
            return;
        }

        $userId = $dataIsolation->getCurrentUserId() ?? '';
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();

        switch ($data->getOperation()) {
            case 'CREATE':
                $event = new FileUploadedEvent($taskFileEntity, $userId, $organizationCode);
                $this->eventDispatcher->dispatch($event);
                break;
            case 'UPDATE':
                $event = new FileContentSavedEvent($taskFileEntity, $userId, $organizationCode);
                $this->eventDispatcher->dispatch($event);
                break;
            case 'DELETE':
                $event = new FileDeletedEvent($taskFileEntity, $userId, $organizationCode);
                $this->eventDispatcher->dispatch($event);
                break;
        }
    }
}

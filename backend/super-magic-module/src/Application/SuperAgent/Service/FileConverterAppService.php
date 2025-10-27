<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Application\File\Service\FileAppService;
use App\Application\File\Service\FileCleanupAppService;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\ConvertStatusEnum;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\FileConverter\FileConverterInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\FileConverter\Request\FileConverterRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\FileConverter\Response\FileConverterResponse;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\FileConverter\Response\FileItemDTO;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\ConvertFilesRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\FileConvertStatusResponseDTO;
use Exception;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Coroutine\go;

/**
 * File Converter Application Service.
 * Coordinates the entire file conversion process, including sandbox creation, initialization, and file conversion.
 */
class FileConverterAppService extends AbstractAppService
{
    private LoggerInterface $logger;

    public function __construct(
        LoggerFactory $loggerFactory,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly FileConverterInterface $fileConverterService,
        private readonly FileConvertStatusManager $fileConvertStatusManager,
        private readonly FileAppService $fileAppService,
        private readonly SandboxGatewayInterface $sandboxGateway,
        private readonly FileCleanupAppService $fileCleanupAppService,
        private readonly ProjectDomainService $projectDomainService,
    ) {
        $this->logger = $loggerFactory->get('FileConverter');
    }

    /**
     * Batch converts files.
     * Main process:
     * 1. Validate file permissions and project access rights.
     * 2. Generate a fixed sandbox ID based on the project ID.
     * 3. Create a sandbox and initialize the Agent.
     * 4. Call the file conversion interface.
     * 5. Return a response in a unified format.
     * @throws Throwable
     */
    public function convertFiles(MagicUserAuthorization $userAuthorization, ConvertFilesRequestDTO $requestDTO): array
    {
        $userId = $userAuthorization->getId();
        $fileIds = $requestDTO->file_ids;
        $convertType = $requestDTO->convert_type;
        $projectId = $requestDTO->project_id;
        $taskKey = null;

        $this->logger->info('Received request to convert files', [
            'user_id' => $userId,
            'project_id' => $projectId,
            'file_ids_count' => count($fileIds),
            'convert_type' => $convertType,
        ]);

        try {
            // Basic validation
            $this->validateConvertRequest($fileIds);

            // Permission validation and file retrieval
            $projectEntity = $this->getAccessibleProject((int) $projectId, $userAuthorization->getId(), $userAuthorization->getOrganizationCode());

            $validFiles = $this->getValidFiles($fileIds, $projectEntity->getId());
            // Check for duplicate requests
            $taskKey = $this->handleDuplicateRequest($userAuthorization, $fileIds, $convertType, $userId);
            if (is_array($taskKey)) {
                return $taskKey; // Return existing task status
            }

            // Initialize the task and start processing
            $this->fileConvertStatusManager->initializeTask($taskKey, $userId, count($validFiles), $convertType);
            $this->processFileConversion($taskKey, $userAuthorization, $requestDTO, $validFiles, $projectEntity);

            return [
                'status' => ConvertStatusEnum::PROCESSING->value,
                'task_key' => $taskKey,
                'download_url' => null,
                'file_count' => count($validFiles),
                'message' => 'Processing, please check status later',
            ];
        } catch (Throwable $e) {
            // If the task has been initialized, mark it as failed
            if ($taskKey) {
                $this->fileConvertStatusManager->setTaskFailed($taskKey, $e->getMessage());
            }

            $this->logger->error('Convert files request failed', [
                'user_id' => $userId,
                'project_id' => $projectId,
                'file_ids_count' => count($fileIds),
                'convert_type' => $convertType,
                'task_key' => $taskKey,
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);

            throw $e;
        }
    }

    /**
     * Checks the status of a file conversion task.
     */
    public function checkFileConvertStatus(MagicUserAuthorization $userAuthorization, string $taskKey): FileConvertStatusResponseDTO
    {
        $userId = $userAuthorization->getId();

        // Verify user permissions
        if (! $this->fileConvertStatusManager->verifyUserPermission($taskKey, $userId)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_ACCESS_DENIED, 'file.convert_access_denied');
        }

        // Get task status
        $taskStatus = $this->fileConvertStatusManager->getTaskStatus($taskKey);
        if (! $taskStatus) {
            return $this->createProcessingResponse('Task not found or expired');
        }

        $sandboxId = $taskStatus['sandbox_id'] ?? '';
        if (empty($sandboxId)) {
            return $this->createProcessingResponse('Sandbox ID not found');
        }

        $projectId = $taskStatus['project_id'] ?? '';
        if (empty($projectId)) {
            return $this->createProcessingResponse('Project ID not found');
        }

        try {
            // Call the sandbox gateway to query the conversion result
            $response = $this->fileConverterService->queryConvertResult($sandboxId, $projectId, $taskKey);

            if ($response->isSuccess()) {
                return $this->buildResponseFromConvertResult($response, $taskKey, $userAuthorization);
            }

            // If the query fails, return a failed status directly and log it
            $this->logger->warning('[File Converter] Query convert result failed from sandbox', [
                'task_key' => $taskKey,
                'sandbox_id' => $sandboxId,
                'response_code' => $response->getCode(),
                'response_message' => $response->getMessage(),
            ]);
            return $this->buildFailedResponse($response);
        } catch (Exception $e) {
            // Return local status on query exception
            $this->logger->error('Query convert result failed', [
                'task_key' => $taskKey,
                'sandbox_id' => $sandboxId,
                'project_id' => $projectId,
                'user_id' => $userId,
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);

            return $this->getLocalTaskStatus($taskStatus);
        }
    }

    /**
     * Processes the file conversion.
     *
     * @param string $taskKey the task key
     * @param MagicUserAuthorization $userAuthorization user authorization
     * @param ConvertFilesRequestDTO $requestDTO the conversion request DTO
     * @param TaskFileEntity[] $validFiles the list of valid files
     * @param ProjectEntity $projectEntity the project entity
     */
    protected function processFileConversion(
        string $taskKey,
        MagicUserAuthorization $userAuthorization,
        ConvertFilesRequestDTO $requestDTO,
        array $validFiles,
        ProjectEntity $projectEntity
    ): void {
        $totalFiles = count($validFiles);
        $userId = $userAuthorization->getId();
        $convertType = $requestDTO->convert_type;
        $projectId = (string) $projectEntity->getId();

        // 校验：不支持 md 转 ppt
        if (strtolower($convertType) === 'ppt') {
            foreach ($validFiles as $fileEntity) {
                $ext = strtolower($fileEntity->getFileExtension());
                if ($ext === 'md' || $ext === '.md') {
                    ExceptionBuilder::throw(
                        SuperAgentErrorCode::FILE_CONVERT_FAILED,
                        'file.convert_md_to_ppt_not_supported'
                    );
                }
            }
        }

        try {
            $this->fileConvertStatusManager->setTaskProgress($taskKey, 0, $totalFiles, 'Starting file conversion');

            // Generate a sandbox ID and store task information
            $sandboxId = $this->generateFileConverterSandboxId($projectEntity->getId());
            $this->fileConvertStatusManager->setTaskMetadata($taskKey, [
                'sandbox_id' => $sandboxId,
                'project_id' => $projectId,
            ]);

            // Get full workdir first
            $fullPrefix = $this->taskFileDomainService->getFullPrefix($projectEntity->getUserOrganizationCode());
            $fullWorkdir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $projectEntity->getWorkDir());

            // Build file keys and get temporary credentials
            $fileKeys = $this->buildFileKeys($validFiles, $fullWorkdir);
            $stsTemporaryCredential = $this->getStsCredential($userAuthorization, $projectEntity->getWorkDir(), $projectEntity->getUserOrganizationCode());

            $this->fileConvertStatusManager->setTaskProgress($taskKey, $totalFiles - 1, $totalFiles, 'Converting files');
            // Synchronously ensure sandbox is available and execute conversion in a coroutine
            $this->sandboxGateway->setUserContext($userId, $userAuthorization->getOrganizationCode());
            $actualSandboxId = $this->sandboxGateway->ensureSandboxAvailable($sandboxId, $projectId, $fullWorkdir);
            // Create file conversion request
            $fileRequest = new FileConverterRequest(
                $actualSandboxId,
                $convertType,
                $fileKeys,
                $stsTemporaryCredential,
                $requestDTO->options,
                $taskKey,
                $userId,
                $userAuthorization->getOrganizationCode()
            );

            $requestId = CoContext::getRequestId() ?: (string) IdGenerator::getSnowId();
            go(function () use ($taskKey, $userAuthorization, $fileRequest, $projectId, $requestId, $fullWorkdir) {
                $fileKeys = $fileRequest->getFileKeys();
                $actualSandboxId = $fileRequest->getSandboxId();
                CoContext::setRequestId($requestId);
                $convertType = $fileRequest->getConvertType();
                try {
                    $response = $this->fileConverterService->convert($userAuthorization->getId(), $userAuthorization->getOrganizationCode(), $actualSandboxId, $projectId, $fileRequest, $fullWorkdir);

                    if (! $response->isSuccess()) {
                        $this->fileConvertStatusManager->setTaskFailed($taskKey, 'File conversion failed,reason: ' . $response->getMessage());
                        return;
                    }

                    $this->logger->info('File conversion task submitted successfully', [
                        'task_key' => $taskKey,
                        'user_id' => $userAuthorization->getId(),
                        'sandbox_id' => $actualSandboxId,
                        'project_id' => $projectId,
                        'file_count' => count($fileKeys),
                        'convert_type' => $convertType,
                        'response_code' => $response->getCode(),
                        'response_message' => $response->getMessage(),
                    ]);
                } catch (Throwable $e) {
                    $this->fileConvertStatusManager->setTaskFailed($taskKey, 'Async conversion failed: ' . $e->getMessage());
                    $this->logger->error('Async conversion failed', [
                        'task_key' => $taskKey,
                        'project_id' => $projectId,
                        'sandbox_id' => $actualSandboxId,
                        'user_id' => $userAuthorization->getId(),
                        'convert_type' => $convertType,
                        'error' => $e->getMessage(),
                        'file' => $e->getFile(),
                        'line' => $e->getLine(),
                        'trace' => $e->getTraceAsString(),
                    ]);
                }
            });

            $this->logger->info('File conversion request submitted asynchronously', [
                'task_key' => $taskKey,
                'user_id' => $userId,
                'project_id' => $projectEntity->getId(),
                'sandbox_id' => $sandboxId,
                'file_count' => count($fileKeys),
                'convert_type' => $convertType,
            ]);
        } catch (Throwable $e) {
            $this->fileConvertStatusManager->setTaskFailed($taskKey, $e->getMessage());
            $this->logger->error('File conversion failed', [
                'task_key' => $taskKey,
                'project_id' => $projectEntity->getId(),
                'user_id' => $userId,
                'convert_type' => $convertType,
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Generates a fixed sandbox ID for file conversion based on the project ID.
     */
    private function generateFileConverterSandboxId(int $projectId): string
    {
        // Use project ID + file conversion business identifier to generate a fixed sandbox ID
        return WorkDirectoryUtil::generateUniqueCodeFromSnowflakeId($projectId . '_file_converter');
    }

    /**
     * Generates a temporary directory path based on the working directory.
     *
     * @param string $workDir The working directory path, e.g., /SUPER_MAGIC/usi_xxx/project_803277391451111425
     * @return string The temporary directory path, e.g., /SUPER_MAGIC/usi_xxx/temp
     */
    private function generateTempDir(string $workDir): string
    {
        // Remove trailing slash
        $workDir = rtrim($workDir, '/');

        // Extract the first two parts of the path (/SUPER_MAGIC/usi_xxx)
        $pathParts = explode('/', $workDir);

        // Reassemble the user-level base path
        $userBasePath = '';
        if (count($pathParts) >= 3) {
            // $pathParts[0] is an empty string (because the path starts with /)
            // $pathParts[1] is SUPER_MAGIC
            // $pathParts[2] is the user ID
            $userBasePath = '/' . $pathParts[1] . '/' . $pathParts[2];
        }

        // Generate the user-level temporary directory
        return $userBasePath . '/temp';
    }

    /**
     * Registers converted files for scheduled cleanup.
     * @param FileItemDTO[] $convertedFiles
     */
    private function registerConvertedFilesForCleanup(MagicUserAuthorization $userAuthorization, array $convertedFiles, ?string $batchId): void
    {
        if (empty($convertedFiles)) {
            return;
        }

        $filesForCleanup = [];
        foreach ($convertedFiles as $file) {
            if (empty($file->ossKey)) {
                continue;
            }

            // Parse filename from oss_key
            $filename = $this->extractFilenameFromOssKey($file->ossKey);
            if (empty($filename)) {
                // If filename cannot be parsed from oss_key, use the filename field
                $filename = $file->filename ?: basename($file->ossKey);
            }

            $filesForCleanup[] = [
                'organization_code' => $userAuthorization->getOrganizationCode(),
                'file_key' => $file->ossKey,
                'file_name' => $filename,
                'file_size' => 0, // The size field is not in FileItemDTO, set to 0
                'source_type' => 'file_conversion',
                'source_id' => $batchId,
                'expire_after_seconds' => 7200, // Expires after 2 hours
                'bucket_type' => 'private',
            ];
        }

        if (! empty($filesForCleanup)) {
            $this->registerConvertedPdfsForCleanup($userAuthorization, $filesForCleanup);
            $this->logger->info('[File Converter] Registered converted files for cleanup', [
                'user_id' => $userAuthorization->getId(),
                'files_count' => count($filesForCleanup),
                'batch_id' => $batchId,
            ]);
        }
    }

    /**
     * Extracts the filename from an OSS Key.
     */
    private function extractFilenameFromOssKey(string $ossKey): string
    {
        // Extract filename from OSS Key (the last part of the path)
        return basename($ossKey);
    }

    /**
     * Creates a response for the processing state.
     */
    private function createProcessingResponse(string $message): FileConvertStatusResponseDTO
    {
        return new FileConvertStatusResponseDTO(
            ConvertStatusEnum::PROCESSING->value,
            null,
            0,
            $message
        );
    }

    /**
     * Builds a response from the conversion result.
     */
    private function buildResponseFromConvertResult(FileConverterResponse $response, string $taskKey, MagicUserAuthorization $userAuthorization): FileConvertStatusResponseDTO
    {
        $status = $response->getDataDTO()->status;

        return match ($status) {
            ConvertStatusEnum::COMPLETED->value => $this->buildCompletedResponse($response, $taskKey, $userAuthorization),
            ConvertStatusEnum::FAILED->value => $this->buildFailedResponse($response),
            default => $this->buildProcessingResponseFromResult($response, $taskKey),
        };
    }

    /**
     * Builds a response for the completed state.
     */
    private function buildCompletedResponse(FileConverterResponse $response, string $taskKey, MagicUserAuthorization $userAuthorization): FileConvertStatusResponseDTO
    {
        // 优先查找 zip；若不存在，则回退到 pdf/ppt/pptx 等单文件类型
        $targetOssKey = null;
        $preferredTypes = ['zip', 'pdf', 'ppt', 'pptx'];

        // 先尝试优先类型顺序匹配
        foreach ($preferredTypes as $preferredType) {
            foreach ($response->getConvertedFiles() as $file) {
                if (strtolower($file->type) === $preferredType) {
                    $targetOssKey = $file->ossKey;
                    break 2;
                }
            }
        }

        // 如果仍未找到，则回退到第一个可用文件
        if ($targetOssKey === null) {
            foreach ($response->getConvertedFiles() as $file) {
                if (! empty($file->ossKey)) {
                    $targetOssKey = $file->ossKey;
                    break;
                }
            }
        }

        $downloadUrl = null;
        if ($targetOssKey) {
            try {
                $fileLinks = $this->fileAppService->getLinks($userAuthorization->getOrganizationCode(), [$targetOssKey]);
                $downloadUrl = $fileLinks[$targetOssKey]->getUrl();
            } catch (Throwable $e) {
                $this->logger->error('Failed to generate download URL for converted file', [
                    'task_key' => $taskKey,
                    'user_id' => $userAuthorization->getId(),
                    'organization_code' => $userAuthorization->getOrganizationCode(),
                    'oss_key' => $targetOssKey,
                    'batch_id' => $response->getBatchId(),
                    'error' => $e->getMessage(),
                    'file' => $e->getFile(),
                    'line' => $e->getLine(),
                    'trace' => $e->getTraceAsString(),
                ]);
            }
        }

        $totalFiles = $response->getTotalFiles();
        $successCount = $response->getSuccessCount();

        // If there is a download URL, register for cleanup
        if ($downloadUrl) {
            $this->registerConvertedFilesForCleanup($userAuthorization, $response->getConvertedFiles(), $response->getBatchId());
        }

        return new FileConvertStatusResponseDTO(
            ConvertStatusEnum::COMPLETED->value,
            $downloadUrl,
            100,
            $downloadUrl ? 'Files are ready for download' : 'Conversion completed but no download file available',
            $totalFiles,
            $successCount,
            $response->getDataDTO()->convertType,
            $response->getBatchId(),
            $taskKey,
            $response->getConversionRate()
        );
    }

    /**
     * Builds a response for the failed state.
     */
    private function buildFailedResponse(FileConverterResponse $response): FileConvertStatusResponseDTO
    {
        return new FileConvertStatusResponseDTO(
            ConvertStatusEnum::FAILED->value,
            null,
            null,
            $response->getMessage() ?: 'Task failed',
            null,
            null,
            null,
            $response->getBatchId()
        );
    }

    /**
     * Builds a response for the processing state (from result).
     */
    private function buildProcessingResponseFromResult(FileConverterResponse $response, string $taskKey): FileConvertStatusResponseDTO
    {
        $progressValue = $response->getDataDTO()->progress ?? 0;

        return new FileConvertStatusResponseDTO(
            ConvertStatusEnum::PROCESSING->value,
            null,
            $progressValue,
            $response->getMessage() ?: 'Processing...',
            $response->getTotalFiles(),
            $response->getSuccessCount(),
            null,
            $response->getBatchId(),
            $taskKey,
            $response->getConversionRate()
        );
    }

    /**
     * Gets the local task status.
     */
    private function getLocalTaskStatus(array $taskStatus): FileConvertStatusResponseDTO
    {
        $status = $taskStatus['status'];
        $progress = $taskStatus['progress'] ?? [];
        $result = $taskStatus['result'] ?? [];
        $error = $taskStatus['error'] ?? '';
        $conversionRate = $result['conversion_rate'] ?? null;

        return match ($status) {
            ConvertStatusEnum::COMPLETED->value => $this->buildLocalCompletedResponse($result, $taskStatus['convert_type'] ?? 'unknown', $conversionRate),
            ConvertStatusEnum::FAILED->value => $this->buildLocalFailedResponse($error, $conversionRate),
            default => $this->buildLocalProcessingResponse($progress, $conversionRate),
        };
    }

    /**
     * Builds a local response for the completed state.
     */
    private function buildLocalCompletedResponse(array $result, string $convertType, ?float $conversionRate): FileConvertStatusResponseDTO
    {
        $downloadUrl = $result['download_url'] ?? '';
        return new FileConvertStatusResponseDTO(
            ConvertStatusEnum::COMPLETED->value,
            $downloadUrl,
            100,
            'Files are ready for download',
            null,
            null,
            $convertType,
            null,
            null,
            $conversionRate
        );
    }

    /**
     * Builds a local response for the failed state.
     */
    private function buildLocalFailedResponse(string $error, ?float $conversionRate): FileConvertStatusResponseDTO
    {
        return new FileConvertStatusResponseDTO(
            ConvertStatusEnum::FAILED->value,
            null,
            null,
            $error ?: 'Task failed',
            null,
            null,
            null,
            null,
            null,
            $conversionRate
        );
    }

    /**
     * Builds a local response for the processing state.
     */
    private function buildLocalProcessingResponse(array $progress, ?float $conversionRate): FileConvertStatusResponseDTO
    {
        $progressValue = $progress['percentage'] ?? 0;
        $progressMessage = $progress['message'] ?? 'Processing...';

        return new FileConvertStatusResponseDTO(
            ConvertStatusEnum::PROCESSING->value,
            null,
            (int) $progressValue,
            $progressMessage,
            null,
            null,
            null,
            null,
            null,
            $conversionRate
        );
    }

    /**
     * Validates the basic parameters of the conversion request.
     */
    private function validateConvertRequest(array $fileIds): void
    {
        if (empty($fileIds)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_FILE_IDS_REQUIRED);
        }

        if (count($fileIds) > 200) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_TOO_MANY_FILES);
        }
    }

    /**
     * Retrieves valid files to which the user has permission.
     *
     * @param array $fileIds array of file IDs
     * @return TaskFileEntity[] list of user files
     */
    private function getValidFiles(array $fileIds, int $projectId): array
    {
        $userFiles = $this->taskFileDomainService->findFilesByProjectIdAndIds($projectId, $fileIds);

        if (empty($userFiles)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_NO_VALID_FILES);
        }
        return $userFiles;
    }

    /**
     * Handles duplicate request checks.
     *
     * @return array|string returns the taskKey for a new request, or the status of an existing task for a duplicate request
     */
    private function handleDuplicateRequest(MagicUserAuthorization $userAuthorization, array $fileIds, string $convertType, string $userId): array|string
    {
        $sortedFileIds = $fileIds;
        sort($sortedFileIds);
        $requestKey = md5($userId . ':' . $convertType . ':' . implode(',', $sortedFileIds));

        $existingTaskKey = $this->fileConvertStatusManager->getDuplicateTaskKey($requestKey);
        if ($existingTaskKey) {
            $this->logger->info('Duplicate request detected, checking existing task status', [
                'user_id' => $userId,
                'file_ids_count' => count($fileIds),
                'convert_type' => $convertType,
                'existing_task_key' => $existingTaskKey,
            ]);

            $taskStatus = $this->checkFileConvertStatus($userAuthorization, $existingTaskKey);

            if ($taskStatus->getStatus() === ConvertStatusEnum::FAILED->value) {
                $this->fileConvertStatusManager->clearDuplicateTaskKey($requestKey);
                $this->logger->info('Failed task detected, clearing duplicate cache to allow retry', [
                    'user_id' => $userId,
                    'task_key' => $existingTaskKey,
                ]);
            } else {
                $taskStatus->setTaskKey($existingTaskKey);
                return $taskStatus->toArray();
            }
        }

        $taskKey = IdGenerator::getUniqueId32();
        $this->fileConvertStatusManager->setDuplicateTaskKey($requestKey, $taskKey);
        return $taskKey;
    }

    /**
     * Builds an array of file keys.
     * Only returns the relative path after $fullWorkdir.
     *
     * @param TaskFileEntity[] $validFiles list of valid files
     * @param string $fullWorkdir full work directory path
     * @return array an array of relative file keys
     */
    private function buildFileKeys(array $validFiles, string $fullWorkdir): array
    {
        $fileKeys = [];
        $fullWorkdir = rtrim($fullWorkdir, '/');

        foreach ($validFiles as $fileEntity) {
            $fullFileKey = $fileEntity->getFileKey();
            // Remove the $fullWorkdir prefix to get relative path
            if (str_starts_with($fullFileKey, $fullWorkdir . '/')) {
                $fileKeys[] = substr($fullFileKey, strlen($fullWorkdir) + 1);
            } else {
                // Fallback: use original key if prefix doesn't match
                $fileKeys[] = $fullFileKey;
            }
        }

        return $fileKeys;
    }

    /**
     * Gets temporary STS credentials.
     */
    private function getStsCredential(MagicUserAuthorization $userAuthorization, string $workDir, ?string $projectOrganizationCode = null): array
    {
        $projectOrganizationCode = $projectOrganizationCode ?? $userAuthorization->getOrganizationCode();
        $tempDir = $this->generateTempDir($workDir);
        return $this->fileAppService->getStsTemporaryCredentialV2(
            $projectOrganizationCode,
            'private',
            $tempDir // Expires in 2 hours
        );
    }

    /**
     * 注册转换后的PDF文件以供定时清理.
     */
    private function registerConvertedPdfsForCleanup(MagicUserAuthorization $userAuthorization, array $convertedFiles): void
    {
        if (empty($convertedFiles)) {
            return;
        }

        $filesForCleanup = [];
        foreach ($convertedFiles as $file) {
            if (empty($file['oss_key']) || empty($file['filename'])) {
                continue;
            }

            $filesForCleanup[] = [
                'organization_code' => $userAuthorization->getOrganizationCode(),
                'file_key' => $file['oss_key'],
                'file_name' => $file['filename'],
                'file_size' => $file['size'] ?? 0, // 如果响应中没有size，默认为0
                'source_type' => 'pdf_conversion',
                'source_id' => $file['batch_id'] ?? null,
                'expire_after_seconds' => 7200, // 2 小时后过期
                'bucket_type' => 'private',
            ];
        }

        if (! empty($filesForCleanup)) {
            $this->fileCleanupAppService->registerFilesForCleanup($filesForCleanup);
            $this->logger->info('[PDF Converter] Registered converted PDF files for cleanup', [
                'user_id' => $userAuthorization->getId(),
                'files_count' => count($filesForCleanup),
            ]);
        }
    }
}

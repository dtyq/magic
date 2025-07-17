<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Application\File\Service\FileAppService;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\ConvertStatusEnum;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\WorkspaceDomainService;
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
 * 文件转换应用服务
 * 负责协调文件转换的完整流程，包括沙箱创建、初始化和文件转换.
 */
class FileConverterAppService
{
    private LoggerInterface $logger;

    public function __construct(
        LoggerFactory $loggerFactory,
        private readonly ProjectDomainService $projectDomainService,
        private readonly TaskDomainService $taskDomainService,
        private readonly WorkspaceDomainService $workspaceDomainService,
        private readonly FileConverterInterface $fileConverterService,
        private readonly FileConvertStatusManager $fileConvertStatusManager,
        private readonly FileAppService $fileAppService,
        private readonly WorkspaceAppService $workspaceAppService,
        private readonly SandboxGatewayInterface $sandboxGateway,
    ) {
        $this->logger = $loggerFactory->get('FileConverter');
    }

    /**
     * 批量转换文件
     * 主要流程：
     * 1. 验证文件权限和项目访问权限
     * 2. 根据项目ID生成固定的沙箱ID
     * 3. 创建沙箱并初始化Agent
     * 4. 调用文件转换接口
     * 5. 返回统一格式的响应.
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
            // 基础验证
            $this->validateConvertRequest($fileIds);

            // 权限验证和文件获取
            $projectEntity = $this->projectDomainService->getProject((int) $projectId, $userId);
            if ($projectEntity->getUserId() !== $userId) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
            }

            $validFiles = $this->getValidFiles($fileIds, $userId);

            // 重复请求检查
            $taskKey = $this->handleDuplicateRequest($userAuthorization, $fileIds, $convertType, $userId);
            if (is_array($taskKey)) {
                return $taskKey; // 返回现有任务状态
            }

            // 初始化任务并开始处理
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
            // 如果任务已经初始化，标记为失败
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
     * 获取文件转换任务状态
     */
    public function checkFileConvertStatus(MagicUserAuthorization $userAuthorization, string $taskKey): FileConvertStatusResponseDTO
    {
        $userId = $userAuthorization->getId();

        // 验证用户权限
        if (! $this->fileConvertStatusManager->verifyUserPermission($taskKey, $userId)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_ACCESS_DENIED, 'file.convert_access_denied');
        }

        // 获取任务状态
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
            // 调用沙箱网关查询转换结果
            $response = $this->fileConverterService->queryConvertResult($sandboxId, $projectId, $taskKey);

            if ($response->isSuccess()) {
                return $this->buildResponseFromConvertResult($response, $taskKey, $userAuthorization);
            }

            // 如果查询失败，直接返回失败状态，并记录日志
            $this->logger->warning('[File Converter] Query convert result failed from sandbox', [
                'task_key' => $taskKey,
                'sandbox_id' => $sandboxId,
                'response_code' => $response->getCode(),
                'response_message' => $response->getMessage(),
            ]);
            return $this->buildFailedResponse($response);
        } catch (Exception $e) {
            // 查询异常时返回本地状态
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
     * 处理文件转换.
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
        $organizationCode = $userAuthorization->getOrganizationCode();
        $projectId = (string) $projectEntity->getId();

        try {
            $this->fileConvertStatusManager->setTaskProgress($taskKey, 0, $totalFiles, 'Starting file conversion');

            // 生成沙箱ID并存储任务信息
            $sandboxId = $this->generateFileConverterSandboxId($projectEntity->getId());
            $this->fileConvertStatusManager->setSandboxId($taskKey, $sandboxId);
            $this->fileConvertStatusManager->setProjectId($taskKey, $projectId);

            // 构建文件URLs和获取临时凭证
            $fileUrls = $this->buildFileUrls($validFiles, $organizationCode, $userId);
            $stsTemporaryCredential = $this->getStsCredential($userAuthorization, $projectEntity->getWorkDir());

            $this->fileConvertStatusManager->setTaskProgress($taskKey, $totalFiles - 1, $totalFiles, 'Converting files');
            // 同步确保沙箱可用并协程执行转换
            $actualSandboxId = $this->sandboxGateway->ensureSandboxAvailable($sandboxId, $projectId);
            // 创建文件转换请求
            $fileRequest = new FileConverterRequest($actualSandboxId, $convertType, $fileUrls, $stsTemporaryCredential, $requestDTO->options, $taskKey);

            $requestId = CoContext::getRequestId() ?: (string) IdGenerator::getSnowId();
            go(function () use ($taskKey, $userAuthorization, $fileRequest, $projectId, $requestId) {
                $fileKeys = $fileRequest->getFileKeys();
                $actualSandboxId = $fileRequest->getSandboxId();
                CoContext::setRequestId($requestId);
                $convertType = $fileRequest->getConvertType();
                try {
                    $response = $this->fileConverterService->convert($actualSandboxId, $projectId, $fileRequest);

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
                'file_count' => count($fileUrls),
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
     * 根据项目ID生成固定的沙箱ID（用于文件转换）.
     */
    private function generateFileConverterSandboxId(int $projectId): string
    {
        // 使用项目ID + 文件转换业务标识生成固定的沙箱ID
        return WorkDirectoryUtil::generateUniqueCodeFromSnowflakeId($projectId . '_file_converter');
    }

    /**
     * 根据工作目录生成临时目录路径.
     *
     * @param string $workDir 工作目录路径，例如：/SUPER_MAGIC/usi_7839078ce6af2d3249b82e7aaed643b8/project_803277391451111425
     * @return string 临时目录路径，例如：/SUPER_MAGIC/usi_7839078ce6af2d3249b82e7aaed643b8/temp
     */
    private function generateTempDir(string $workDir): string
    {
        // 移除末尾的斜杠
        $workDir = rtrim($workDir, '/');

        // 提取路径的前两部分（/SUPER_MAGIC/usi_xxx）
        $pathParts = explode('/', $workDir);

        // 重新组装用户级别的基础路径
        $userBasePath = '';
        if (count($pathParts) >= 3) {
            // $pathParts[0] 是空字符串（因为路径以 / 开头）
            // $pathParts[1] 是 SUPER_MAGIC
            // $pathParts[2] 是用户ID
            $userBasePath = '/' . $pathParts[1] . '/' . $pathParts[2];
        }

        // 生成用户级别的临时目录
        return $userBasePath . '/temp';
    }

    /**
     * 注册转换后的文件以供定时清理.
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

            // 从oss_key解析文件名
            $filename = $this->extractFilenameFromOssKey($file->ossKey);
            if (empty($filename)) {
                // 如果无法从oss_key解析文件名，使用filename字段
                $filename = $file->filename ?: basename($file->ossKey);
            }

            $filesForCleanup[] = [
                'organization_code' => $userAuthorization->getOrganizationCode(),
                'file_key' => $file->ossKey,
                'file_name' => $filename,
                'file_size' => 0, // FileItemDTO 中没有 size 字段，设置为0
                'source_type' => 'file_conversion',
                'source_id' => $batchId,
                'expire_after_seconds' => 7200, // 2 小时后过期
                'bucket_type' => 'private',
            ];
        }

        if (! empty($filesForCleanup)) {
            $this->workspaceAppService->registerConvertedPdfsForCleanup($userAuthorization, $filesForCleanup);
            $this->logger->info('[File Converter] Registered converted files for cleanup', [
                'user_id' => $userAuthorization->getId(),
                'files_count' => count($filesForCleanup),
                'batch_id' => $batchId,
            ]);
        }
    }

    /**
     * 从OSS Key中提取文件名.
     */
    private function extractFilenameFromOssKey(string $ossKey): string
    {
        // 从OSS Key中提取文件名（路径的最后一部分）
        return basename($ossKey);
    }

    /**
     * 创建处理中状态的响应.
     */
    private function createProcessingResponse(string $message, int $progress = 0): FileConvertStatusResponseDTO
    {
        return new FileConvertStatusResponseDTO(
            ConvertStatusEnum::PROCESSING->value,
            null,
            $progress,
            $message
        );
    }

    /**
     * 从转换结果构建响应.
     */
    private function buildResponseFromConvertResult(FileConverterResponse $response, string $taskKey, MagicUserAuthorization $userAuthorization): FileConvertStatusResponseDTO
    {
        $status = $response->getDataDTO()->status;

        switch ($status) {
            case ConvertStatusEnum::COMPLETED->value:
                return $this->buildCompletedResponse($response, $taskKey, $userAuthorization);
            case ConvertStatusEnum::FAILED->value:
                return $this->buildFailedResponse($response);
            case ConvertStatusEnum::PROCESSING->value:
            default:
                return $this->buildProcessingResponseFromResult($response, $taskKey);
        }
    }

    /**
     * 构建完成状态的响应.
     */
    private function buildCompletedResponse(FileConverterResponse $response, string $taskKey, MagicUserAuthorization $userAuthorization): FileConvertStatusResponseDTO
    {
        $zipOssKey = null;
        foreach ($response->getConvertedFiles() as $file) {
            if ($file->type === 'zip') {
                $zipOssKey = $file->ossKey;
                break;
            }
        }

        $downloadUrl = null;
        if ($zipOssKey) {
            try {
                $fileLinks = $this->fileAppService->getLinks($userAuthorization->getOrganizationCode(), [$zipOssKey]);
                $downloadUrl = $fileLinks[$zipOssKey]->getUrl() ?? null;
            } catch (Throwable $e) {
                $this->logger->error('Failed to generate download URL for converted file', [
                    'task_key' => $taskKey,
                    'user_id' => $userAuthorization->getId(),
                    'organization_code' => $userAuthorization->getOrganizationCode(),
                    'zip_oss_key' => $zipOssKey,
                    'batch_id' => $response->getBatchId(),
                    'error' => $e->getMessage(),
                    'file' => $e->getFile(),
                    'line' => $e->getLine(),
                    'trace' => $e->getTraceAsString(),
                ]);
                $downloadUrl = null;
            }
        }

        $totalFiles = $response->getTotalFiles();
        $successCount = $response->getSuccessCount();

        // 如果有下载URL，注册清理
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
     * 构建失败状态的响应.
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
     * 构建处理中状态的响应（从结果）.
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
     * 获取本地任务状态
     */
    private function getLocalTaskStatus(array $taskStatus): FileConvertStatusResponseDTO
    {
        $status = $taskStatus['status'];
        $progress = $taskStatus['progress'] ?? [];
        $result = $taskStatus['result'] ?? [];
        $error = $taskStatus['error'] ?? '';
        $conversionRate = $result['conversion_rate'] ?? null;

        switch ($status) {
            case ConvertStatusEnum::COMPLETED->value:
                return $this->buildLocalCompletedResponse($result, $taskStatus['convert_type'] ?? 'unknown', $conversionRate);
            case ConvertStatusEnum::FAILED->value:
                return $this->buildLocalFailedResponse($error, $conversionRate);
            case ConvertStatusEnum::PROCESSING->value:
            default:
                return $this->buildLocalProcessingResponse($progress, $conversionRate);
        }
    }

    /**
     * 构建本地完成状态的响应.
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
     * 构建本地失败状态的响应.
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
     * 构建本地处理中状态的响应.
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
     * 验证转换请求的基础参数.
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
     * 获取用户有权限的有效文件.
     */
    private function getValidFiles(array $fileIds, string $userId): array
    {
        $userFiles = $this->taskDomainService->getTaskFiles($fileIds);
        if (empty($userFiles)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_NO_VALID_FILES);
        }

        // 验证文件归属权并过滤
        $validFiles = [];
        $topicIds = array_unique(array_map(static fn ($file) => $file->getTopicId(), $userFiles));
        $topics = $this->workspaceDomainService->getTopicsByIds($topicIds);
        $topicsById = [];
        foreach ($topics as $topic) {
            $topicsById[$topic->getId()] = $topic;
        }
        foreach ($userFiles as $fileEntity) {
            $topic = $topicsById[$fileEntity->getTopicId()] ?? null;
            if ($topic && $topic->getUserId() === $userId) {
                $validFiles[] = $fileEntity;
            }
        }

        if (empty($validFiles)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_ACCESS_DENIED);
        }

        return $validFiles;
    }

    /**
     * 处理重复请求检查.
     *
     * @return array|string 如果是新请求返回taskKey，如果是重复请求返回现有任务状态
     */
    private function handleDuplicateRequest(MagicUserAuthorization $userAuthorization, array $fileIds, string $convertType, string $userId)
    {
        $sortedFileIds = $fileIds;
        sort($sortedFileIds);
        $requestKey = md5((string) $userId . ':' . $convertType . ':' . implode(',', $sortedFileIds));

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
     * 构建文件URL数组.
     */
    private function buildFileUrls(array $validFiles, string $organizationCode, string $userId): array
    {
        $fileKeys = [];
        $downloadNames = [];
        foreach ($validFiles as $fileEntity) {
            $fileKey = $fileEntity->getFileKey();
            $fileKeys[] = $fileKey;
            $downloadNames[$fileKey] = $fileEntity->getFileName();
        }

        $fileLinks = $this->fileAppService->getLinks($organizationCode, $fileKeys, null, $downloadNames);
        $fileUrls = [];
        foreach ($validFiles as $fileEntity) {
            $fileKey = $fileEntity->getFileKey();
            $fileLink = $fileLinks[$fileKey] ?? null;

            if ($fileLink) {
                $fileUrls[] = [
                    'file_key' => $fileKey,
                    'file_url' => $fileLink->getUrl(),
                ];
            } else {
                $this->logger->warning('Failed to get download link for file', [
                    'file_key' => $fileKey,
                    'user_id' => $userId,
                ]);
            }
        }

        if (empty($fileUrls)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_NO_VALID_FILES);
        }

        return $fileUrls;
    }

    /**
     * 获取STS临时凭证.
     */
    private function getStsCredential(MagicUserAuthorization $userAuthorization, string $workDir): array
    {
        $tempDir = $this->generateTempDir($workDir);
        return $this->fileAppService->getStsTemporaryCredential(
            $userAuthorization,
            'private',
            $tempDir,
            7200 // 2小时过期
        );
    }
}

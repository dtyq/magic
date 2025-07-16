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
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\ConvertFilesRequestDTO;
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
        $fileIds = $requestDTO->file_ids;
        $convertType = $requestDTO->convert_type;
        $projectId = $requestDTO->project_id;
        $userId = $userAuthorization->getId();

        $this->logger->info('Received request to convert files', [
            'user_id' => $userId,
            'project_id' => $projectId,
            'file_ids_count' => count($fileIds),
            'convert_type' => $convertType,
        ]);

        if (empty($fileIds)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_FILE_IDS_REQUIRED);
        }

        // 基础验证
        if (count($fileIds) > 200) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_TOO_MANY_FILES);
        }

        // 检查项目访问权限
        $projectEntity = $this->projectDomainService->getProject((int) $projectId, $userId);
        if ($projectEntity->getUserId() !== $userId) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
        }

        // 权限验证：获取用户可访问的文件
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

        // 对 file_ids 排序后生成唯一键，防止重复提交
        $sortedFileIds = $fileIds;
        sort($sortedFileIds);
        $requestKey = md5($userId . ':' . $convertType . ':' . implode(',', $sortedFileIds));

        // 检查是否在1分钟内有相同的请求
        $existingTaskKey = $this->fileConvertStatusManager->getDuplicateTaskKey($requestKey);
        if ($existingTaskKey) {
            $this->logger->info('Duplicate request detected, checking existing task status', [
                'user_id' => $userId,
                'file_ids_count' => count($fileIds),
                'convert_type' => $convertType,
                'existing_task_key' => $existingTaskKey,
            ]);

            // 获取现有任务的状态
            $taskStatus = $this->checkFileConvertStatus($userAuthorization, $existingTaskKey);

            // 如果任务失败，清除缓存的重复请求键，允许重新提交
            if (isset($taskStatus['status']) && $taskStatus['status'] === ConvertStatusEnum::FAILED->value) {
                $this->fileConvertStatusManager->clearDuplicateTaskKey($requestKey);
                $this->logger->info('Failed task detected, clearing duplicate cache to allow retry', [
                    'user_id' => $userId,
                    'task_key' => $existingTaskKey,
                ]);
            } else {
                // 任务正在进行中或成功，返回现有任务状态
                $taskStatus['task_key'] = $existingTaskKey;
                return $taskStatus;
            }
        }

        // 生成任务键
        $taskKey = IdGenerator::getUniqueId32();

        // 缓存请求键以防重复提交
        $this->fileConvertStatusManager->setDuplicateTaskKey($requestKey, $taskKey);

        // 初始化任务状态
        $this->fileConvertStatusManager->initializeTask($taskKey, $userId, count($validFiles), $convertType);

        // 直接处理文件转换
        $this->processFileConversion($taskKey, $userAuthorization, $requestDTO, $validFiles, $projectEntity);

        return [
            'status' => ConvertStatusEnum::PROCESSING->value,
            'task_key' => $taskKey,
            'download_url' => null,
            'file_count' => count($validFiles),
            'message' => 'Processing, please check status later',
        ];
    }

    /**
     * 获取文件转换任务状态
     */
    public function checkFileConvertStatus(MagicUserAuthorization $userAuthorization, string $taskKey): array
    {
        $userId = $userAuthorization->getId();

        // 验证用户权限
        if (! $this->fileConvertStatusManager->verifyUserPermission($taskKey, $userId)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_ACCESS_DENIED, 'file.convert_access_denied');
        }

        // 获取任务状态
        $taskStatus = $this->fileConvertStatusManager->getTaskStatus($taskKey);
        if (! $taskStatus) {
            return [
                'status' => ConvertStatusEnum::PROCESSING->value,
                'download_url' => null,
                'progress' => 0,
                'message' => 'Task not found or expired',
            ];
        }

        $sandboxId = $taskStatus['sandbox_id'] ?? '';
        if (empty($sandboxId)) {
            return [
                'status' => ConvertStatusEnum::PROCESSING->value,
                'download_url' => null,
                'progress' => 0,
                'message' => 'Sandbox ID not found',
            ];
        }

        $projectId = $taskStatus['project_id'] ?? '';
        if (empty($projectId)) {
            return [
                'status' => ConvertStatusEnum::PROCESSING->value,
                'download_url' => null,
                'progress' => 0,
                'message' => 'Project ID not found',
            ];
        }

        try {
            // 调用沙箱网关查询转换结果
            $response = $this->fileConverterService->queryConvertResult($sandboxId, $projectId, $taskKey);

            if ($response->isSuccess()) {
                $data = $response->getData();
                $status = $data['status'] ?? 'processing';

                switch ($status) {
                    case ConvertStatusEnum::COMPLETED->value:
                        $downloadUrl = $response->getZipDownloadUrl();
                        $totalFiles = $response->getTotalFiles();
                        $successCount = $response->getSuccessCount();

                        return [
                            'status' => 'ready',
                            'download_url' => $downloadUrl,
                            'progress' => 100,
                            'message' => $downloadUrl ? 'Files are ready for download' : 'Conversion completed but no download file available',
                            'file_count' => $totalFiles,
                            'success_count' => $successCount,
                            'convert_type' => $data['convert_type'] ?? 'unknown',
                            'batch_id' => $response->getBatchId(),
                        ];

                    case ConvertStatusEnum::FAILED->value:
                        return [
                            'status' => ConvertStatusEnum::FAILED->value,
                            'download_url' => null,
                            'progress' => null,
                            'message' => $response->getMessage() ?: 'Task failed',
                            'batch_id' => $response->getBatchId(),
                        ];

                    case ConvertStatusEnum::PROCESSING->value:
                    default:
                        // 处理进度信息，可能是百分比数字
                        $progressValue = 0;
                        if (isset($data['progress'])) {
                            $progressValue = is_numeric($data['progress']) ? (int) $data['progress'] : 0;
                        }

                        return [
                            'status' => ConvertStatusEnum::PROCESSING->value,
                            'download_url' => null,
                            'progress' => $progressValue,
                            'message' => $response->getMessage() ?: 'Processing...',
                            'batch_id' => $response->getBatchId(),
                            'total_files' => $response->getTotalFiles(),
                            'success_count' => $response->getSuccessCount(),
                        ];
                }
            } else {
                // 如果查询失败，返回本地状态作为备用
                return $this->getLocalTaskStatus($taskStatus);
            }
        } catch (Exception $e) {
            // 查询异常时返回本地状态
            $this->logger->error('Query convert result failed', [
                'task_key' => $taskKey,
                'sandbox_id' => $sandboxId,
                'error' => $e->getMessage(),
            ]);

            return $this->getLocalTaskStatus($taskStatus);
        }
    }

    /**
     * 处理文件转换.
     */
    private function processFileConversion(
        string $taskKey,
        MagicUserAuthorization $userAuthorization,
        ConvertFilesRequestDTO $requestDTO,
        array $validFiles,
        ProjectEntity $projectEntity
    ): void {
        try {
            $options = $requestDTO->options;
            $convertType = $requestDTO->convert_type;
            $totalFiles = count($validFiles);
            $userId = $userAuthorization->getId();
            $organizationCode = $userAuthorization->getOrganizationCode();

            $this->fileConvertStatusManager->setTaskProgress($taskKey, 0, $totalFiles, 'Starting file conversion');

            // 根据项目ID生成固定的沙箱ID（用于文件转换）
            $sandboxId = $this->generateFileConverterSandboxId($projectEntity->getId());

            // 存储sandbox_id到任务状态中
            $this->fileConvertStatusManager->setSandboxId($taskKey, $sandboxId);

            // 存储project_id到任务状态中
            $this->fileConvertStatusManager->setProjectId($taskKey, (string) $projectEntity->getId());

            // 收集文件键并批量获取下载链接
            $fileKeys = [];
            $downloadNames = [];
            foreach ($validFiles as $fileEntity) {
                $fileKey = $fileEntity->getFileKey();
                $fileKeys[] = $fileKey;
                $downloadNames[$fileKey] = $fileEntity->getFileName();
            }

            // 批量获取文件链接
            $fileLinks = $this->fileAppService->getLinks($organizationCode, $fileKeys, null, $downloadNames);
            // 构建文件URL数组
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

            // 获取STS临时凭证 - 使用workdir同层级的temp目录
            $workDir = $projectEntity->getWorkDir();
            $tempDir = $this->generateTempDir($workDir);
            $stsTemporaryCredential = $this->fileAppService->getStsTemporaryCredential(
                $userAuthorization,
                'private',
                $tempDir,
                7200 // 2小时过期
            );

            $this->fileConvertStatusManager->setTaskProgress($taskKey, $totalFiles - 1, $totalFiles, 'Converting files');

            // 创建文件转换请求，传入 sandboxId, convertType, fileUrls, stsTemporaryCredential, options, taskKey
            $fileRequest = new FileConverterRequest($sandboxId, $convertType, $fileUrls, $stsTemporaryCredential, $options, $taskKey);
            // 使用协程异步处理文件转换
            $this->processFileConversionAsync($taskKey, $userAuthorization, $fileRequest, (string) $projectEntity->getId());

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
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * 异步处理文件转换.
     */
    private function processFileConversionAsync(
        string $taskKey,
        MagicUserAuthorization $userAuthorization,
        FileConverterRequest $fileRequest,
        string $projectId
    ): void {
        $requestId = CoContext::getRequestId() ?: (string) IdGenerator::getSnowId();

        go(function () use ($taskKey, $userAuthorization, $fileRequest, $projectId, $requestId) {
            CoContext::setRequestId($requestId);
            try {
                // 从请求中获取沙箱ID、文件键和转换类型
                $sandboxId = $fileRequest->getSandboxId();
                $fileKeys = $fileRequest->getFileKeys();
                $convertType = $fileRequest->getConvertType();

                // 调用文件转换服务，提交转换任务
                $response = $this->fileConverterService->convert($sandboxId, $projectId, $fileRequest);

                if (! $response->isSuccess()) {
                    $this->fileConvertStatusManager->setTaskFailed($taskKey, 'File conversion failed,reason: ' . $response->getMessage());
                    return;
                }

                $this->logger->info('File conversion task submitted successfully', [
                    'task_key' => $taskKey,
                    'user_id' => $userAuthorization->getId(),
                    'sandbox_id' => $sandboxId,
                    'project_id' => $projectId,
                    'file_count' => count($fileKeys),
                    'convert_type' => $convertType,
                    'response_code' => $response->getCode(),
                    'response_message' => $response->getMessage(),
                ]);

                // 转换任务已提交，状态检查将通过 checkFileConvertStatus 方法调用远程接口获取
                // 不在这里立即检查结果，因为转换是异步的
            } catch (Throwable $e) {
                $this->fileConvertStatusManager->setTaskFailed($taskKey, 'Async conversion failed: ' . $e->getMessage());
                $this->logger->error('Async conversion failed', [
                    'task_key' => $taskKey,
                    'project_id' => $projectId,
                    'error' => $e->getMessage(),
                ]);
            }
        });
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
     * 获取本地任务状态
     */
    private function getLocalTaskStatus(array $taskStatus): array
    {
        $status = $taskStatus['status'];
        $progress = $taskStatus['progress'] ?? [];
        $result = $taskStatus['result'] ?? [];
        $error = $taskStatus['error'] ?? '';

        switch ($status) {
            case ConvertStatusEnum::COMPLETED->value:
                $downloadUrl = $result['download_url'] ?? '';
                return [
                    'status' => 'ready',
                    'download_url' => $downloadUrl,
                    'progress' => 100,
                    'message' => 'Files are ready for download',
                    'file_count' => $result['file_count'] ?? 0,
                    'convert_type' => $taskStatus['convert_type'] ?? 'unknown',
                ];

            case ConvertStatusEnum::FAILED->value:
                return [
                    'status' => ConvertStatusEnum::FAILED->value,
                    'download_url' => null,
                    'progress' => null,
                    'message' => $error ?: 'Task failed',
                ];

            case ConvertStatusEnum::PROCESSING->value:
            default:
                $progressValue = $progress['percentage'] ?? 0;
                $progressMessage = $progress['message'] ?? 'Processing...';

                return [
                    'status' => ConvertStatusEnum::PROCESSING->value,
                    'download_url' => null,
                    'progress' => (int) $progressValue,
                    'message' => $progressMessage,
                ];
        }
    }
}

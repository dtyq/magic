<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Service;

use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Application\File\Service\FileAppService;
use App\Application\File\Service\FileCleanupAppService;
use App\Application\Speech\Assembler\ChatMessageAssembler;
use App\Application\Speech\DTO\ProcessSummaryTaskDTO;
use App\Application\Speech\DTO\SaveFileRecordToProjectDTO;
use App\Application\Speech\Enum\AsrTaskStatusEnum;
use App\Domain\Chat\Service\MagicChatDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\File\DTO\CloudFileInfoDTO;
use App\Domain\File\Service\FileDomainService;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\ExternalAPI\Volcengine\DTO\AsrTaskStatusDTO;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectMemberDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Hyperf\Codec\Json;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Translation\trans;

/**
 * ASR文件管理应用服务 - 负责ASR相关的所有业务逻辑.
 */
readonly class AsrFileAppService
{
    private LoggerInterface $logger;

    public function __construct(
        private FileDomainService $fileDomainService,
        private FileAppService $fileAppService,
        private FileCleanupAppService $fileCleanupAppService,
        private ProjectDomainService $projectDomainService,
        private ProjectMemberDomainService $projectMemberDomainService,
        private TaskFileDomainService $taskFileDomainService,
        private MagicDepartmentUserDomainService $magicDepartmentUserDomainService,
        private ChatMessageAssembler $chatMessageAssembler,
        private MagicChatMessageAppService $magicChatMessageAppService,
        private MagicChatDomainService $magicChatDomainService,
        private Redis $redis,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('AsrFileAppService');
    }

    /**
     * 处理ASR总结任务的完整流程（包含聊天消息发送）.
     *
     * @param string $taskKey 任务键
     * @param string $projectId 项目ID
     * @param string $topicId 话题ID
     * @param MagicUserAuthorization $userAuthorization 用户授权信息（包含用户ID和组织编码）
     * @param string $modelId 模型ID
     * @return array 处理结果
     */
    public function processSummaryWithChat(
        string $taskKey,
        string $projectId,
        string $topicId,
        MagicUserAuthorization $userAuthorization,
        string $modelId
    ): array {
        try {
            // 从用户授权信息中获取必要的用户数据
            $userId = $userAuthorization->getId();
            $organizationCode = $userAuthorization->getOrganizationCode();

            // 1. 通过话题ID获取对话ID
            $conversationId = $this->magicChatDomainService->getConversationIdByTopicId($topicId);

            // 2. 获取并验证任务状态
            $taskStatus = $this->getAndValidateTaskStatus($taskKey, $userId);

            // 3. 验证项目权限 - 确保项目属于当前用户和组织
            $this->validateProjectAccess($projectId, $userId, $organizationCode);

            // 4. 处理ASR总结任务
            if (! $taskStatus->isTaskSubmitted()) {
                // 处理音频文件上传
                $this->updateAudioToWorkspace($taskStatus, $organizationCode, $projectId, $userId);
            }

            // 5. 构建处理总结任务DTO用于发送聊天消息
            $processSummaryTaskDTO = new ProcessSummaryTaskDTO(
                $taskStatus,
                $organizationCode,
                $projectId,
                $userId,
                $topicId,
                $conversationId,
                $modelId
            );

            // 6. 保存更新后的任务状态
            $this->saveTaskStatusToRedis($taskStatus);

            // 7. 发送聊天消息模拟用户总结请求
            $this->sendSummaryChatMessage($processSummaryTaskDTO, $userAuthorization);

            return [
                'success' => true,
                'task_status' => $taskStatus,
                'conversation_id' => $conversationId,
                'chat_result' => true,
            ];
        } catch (Throwable $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'task_status' => null,
                'conversation_id' => null,
                'chat_result' => ['success' => false, 'message_sent' => false, 'error' => $e->getMessage()],
            ];
        }
    }

    /**
     * ASR专用文件上传方法.
     *
     * @param string $organizationCode 组织编码
     * @param UploadFile $uploadFile 上传文件对象
     */
    public function uploadFile(string $organizationCode, UploadFile $uploadFile): void
    {
        $this->fileAppService->upload($organizationCode, $uploadFile, StorageBucketType::SandBox, false);
    }

    /**
     * 下载合并后的音频文件，上传到同个业务目录并返回下载地址.
     *
     * @param string $organizationCode 组织编码
     * @param string $businessDirectory 业务目录
     * @param string $taskKey 任务键
     * @return array 包含下载URL的数组 ['url' => string, 'file_key' => string]
     * @throws InvalidArgumentException
     */
    public function downloadMergedAudio(string $organizationCode, string $businessDirectory, string $taskKey): array
    {
        try {
            // 1. 使用公共方法下载并合并音频文件
            $mergedAudioFile = $this->downloadAndMergeAudio($organizationCode, $businessDirectory, $taskKey);

            // 2. 上传合并后的音频文件到同个业务目录
            $uploadResult = $this->uploadMergedAudioAndGetUrl($organizationCode, $mergedAudioFile, $taskKey, $businessDirectory);

            // 3. 准备需要清理的文件列表 - 列出业务目录下的所有文件
            $allFilesInDirectory = $this->listAllFilesInBusinessDirectory($organizationCode, $businessDirectory);
            $filesForCleanup = [];
            foreach ($allFilesInDirectory as $file) {
                $filesForCleanup[] = $file->getKey();
            }

            // 4. 注册文件删除
            if (! empty($filesForCleanup)) {
                $cleanupFiles = [];
                foreach ($filesForCleanup as $fileKey) {
                    $cleanupFiles[] = [
                        'organization_code' => $organizationCode,
                        'file_key' => $fileKey,
                        'file_name' => basename($fileKey),
                        'file_size' => 0, // 小文件分片大小不重要
                        'source_type' => 'asr_temp_files',
                        'source_id' => $taskKey,
                        'expire_after_seconds' => 3600, // 1小时后清理
                        'bucket_type' => 'sandbox',
                    ];
                }

                $this->fileCleanupAppService->registerFilesForCleanup($cleanupFiles);
            }

            // 5. 清理本地临时文件
            $this->cleanupTaskFiles($taskKey);

            return $uploadResult;
        } catch (Throwable $e) {
            // 异常时只清理本地临时文件
            try {
                $this->cleanupTaskFiles($taskKey);
            } catch (Throwable) {
                // 静默处理清理失败
            }
            throw new InvalidArgumentException(sprintf('下载合并音频失败: %s', $e->getMessage()));
        }
    }

    /**
     * 上传合并后的音频文件并获取可访问的URL.
     *
     * @param string $organizationCode 组织编码
     * @param string $localAudioFile 本地音频文件路径
     * @param string $taskKey 任务键
     * @param string $businessDirectory 业务目录，合并文件将上传到此目录下
     * @return array 包含音频文件URL和文件key的数组 ['url' => string, 'file_key' => string]
     * @throws InvalidArgumentException
     */
    public function uploadMergedAudioAndGetUrl(string $organizationCode, string $localAudioFile, string $taskKey, string $businessDirectory): array
    {
        try {
            if (! file_exists($localAudioFile)) {
                throw new InvalidArgumentException(sprintf('本地音频文件不存在: %s', $localAudioFile));
            }

            // 生成云存储中的文件键 - 与原始录音文件在同一目录下
            $filename = sprintf('merged_%s.webm', $taskKey);
            // 确保 businessDirectory 以 / 结尾
            $businessDirectory = sprintf('%s/', rtrim($businessDirectory, '/'));
            $remoteKey = sprintf('%s%s', ltrim($businessDirectory, '/'), $filename);

            // 创建上传文件对象
            $uploadFile = new UploadFile($localAudioFile, '', $remoteKey, false);

            // ASR相关操作统一使用SandBox存储桶
            $this->fileAppService->upload($organizationCode, $uploadFile, StorageBucketType::SandBox, false);

            // 获取上传后的实际文件键
            $actualFileKey = $uploadFile->getKey();
            // ASR相关操作统一使用SandBox存储桶获取链接
            $fileLink = $this->fileAppService->getLink($organizationCode, $actualFileKey, StorageBucketType::SandBox);

            if (! $fileLink) {
                throw new InvalidArgumentException('无法获取音频文件访问链接');
            }

            return [
                'url' => $fileLink->getUrl(),
                'file_key' => $actualFileKey,
            ];
        } catch (Throwable $e) {
            throw new InvalidArgumentException(sprintf('上传合并音频文件失败: %s', $e->getMessage()));
        }
    }

    /**
     * 清理任务相关的临时文件.
     *
     * @param string $taskKey 任务键
     * @param null|string $organizationCode 组织编码，用于删除OSS上的临时文件
     * @param null|string $businessDirectory 业务目录，用于删除OSS上的临时文件
     */
    public function cleanupTaskFiles(string $taskKey, ?string $organizationCode = null, ?string $businessDirectory = null): void
    {
        // 1. 清理OSS上的临时小文件
        if ($organizationCode && $businessDirectory) {
            $this->cleanupRemoteAudioFiles($organizationCode, $businessDirectory);
        }

        // 2. 清理本地临时文件
        $runtimeDir = sprintf('%s/runtime/asr/%s', BASE_PATH, $taskKey);
        if (is_dir($runtimeDir)) {
            try {
                // 删除目录中的所有文件
                $files = glob(sprintf('%s/*', $runtimeDir));
                foreach ($files as $file) {
                    if (is_file($file)) {
                        unlink($file);
                    }
                }

                // 删除目录
                rmdir($runtimeDir);
            } catch (Throwable $e) {
                $this->logger->warning('本地临时文件清理失败', [
                    'task_key' => $taskKey,
                    'runtime_dir' => $runtimeDir,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    // ==================== 语音识别任务管理 ====================

    /**
     * 验证项目权限 - 确保项目属于当前用户和组织.
     *
     * @param string $projectId 项目ID
     * @param string $userId 用户ID
     * @param string $organizationCode 组织编码
     * @return ProjectEntity 项目实体
     * @throws InvalidArgumentException 当项目不存在或无权限时抛出异常
     */
    public function validateProjectAccess(string $projectId, string $userId, string $organizationCode): ProjectEntity
    {
        try {
            // 获取项目信息
            $projectEntity = $this->projectDomainService->getProjectNotUserId((int) $projectId);
            if ($projectEntity === null) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND);
            }
            // 校验项目是否属于当前组织
            if ($projectEntity->getUserOrganizationCode() !== $organizationCode) {
                throw new InvalidArgumentException(trans('asr.api.validation.project_access_denied_organization'));
            }

            // 校验项目是否属于当前用户
            if ($projectEntity->getUserId() === $userId) {
                return $projectEntity;
            }

            // 检查用户是否是项目成员
            if ($this->projectMemberDomainService->isProjectMemberByUser((int) $projectId, $userId)) {
                return $projectEntity;
            }

            // 检查用户所在部门是否有项目权限
            $dataIsolation = DataIsolation::create($organizationCode, $userId);
            $departmentIds = $this->magicDepartmentUserDomainService->getDepartmentIdsByUserId($dataIsolation, $userId, true);

            if (! empty($departmentIds) && $this->projectMemberDomainService->isProjectMemberByDepartments((int) $projectId, $departmentIds)) {
                return $projectEntity;
            }

            // 所有权限检查都失败
            throw new InvalidArgumentException(trans('asr.api.validation.project_access_denied_user'));
        } catch (BusinessException $e) {
            // 处理 ExceptionBuilder::throw 抛出的业务异常
            if ($e->getCode() === SuperAgentErrorCode::PROJECT_NOT_FOUND->value) {
                throw new InvalidArgumentException(trans('asr.api.validation.project_not_found'));
            }

            // 其他业务异常转换为权限验证失败
            throw new InvalidArgumentException(trans('asr.api.validation.project_access_validation_failed', ['error' => $e->getMessage()]));
        } catch (InvalidArgumentException $e) {
            // 重新抛出权限相关异常
            throw $e;
        } catch (Throwable $e) {
            // 其他异常统一处理为权限验证失败
            throw new InvalidArgumentException(trans('asr.api.validation.project_access_validation_failed', ['error' => $e->getMessage()]));
        }
    }

    /**
     * 构建包含文件列表的响应.
     */
    public function buildFileListResponse(string $organizationCode, string $businessDirectory): array
    {
        $uploadedFiles = [];
        try {
            // 使用ASR文件服务查询音频文件
            $files = $this->getAudioFileList($organizationCode, $businessDirectory);

            foreach ($files as $file) {
                $uploadedFiles[] = [
                    'filename' => $file->getFilename() ?: basename($file->getKey()),
                    'key' => $file->getKey(),
                    'size' => $file->getSize(),
                    'modified' => $file->getLastModified(),
                ];
            }
        } catch (Throwable) {
            // 静默处理，不影响主要功能
        }

        return [
            'files' => $uploadedFiles,
            'file_count' => count($uploadedFiles),
        ];
    }

    // ==================== 任务状态管理 ====================

    /**
     * 从Redis获取任务状态
     *
     * @param string $taskKey 任务键
     * @param string $userId 用户ID
     * @return AsrTaskStatusDTO 任务状态DTO
     */
    public function getTaskStatusFromRedis(string $taskKey, string $userId): AsrTaskStatusDTO
    {
        $redisKey = sprintf('asr:task:%s', md5(sprintf('%s:%s', $userId, $taskKey)));

        try {
            $taskData = $this->redis->hGetAll($redisKey);

            if (empty($taskData)) {
                return new AsrTaskStatusDTO();
            }

            return AsrTaskStatusDTO::fromArray($taskData);
        } catch (Throwable) {
            return new AsrTaskStatusDTO();
        }
    }

    /**
     * 保存任务状态到Redis.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态DTO
     * @param int $ttl 缓存过期时间（秒），默认12小时
     */
    public function saveTaskStatusToRedis(AsrTaskStatusDTO $taskStatus, int $ttl = 43200): void
    {
        try {
            $redisKey = sprintf('asr:task:%s', md5(sprintf('%s:%s', $taskStatus->userId, $taskStatus->taskKey)));

            // 保存任务状态数据
            $this->redis->hMSet($redisKey, $taskStatus->toArray());

            // 设置过期时间
            $this->redis->expire($redisKey, $ttl);
        } catch (Throwable $e) {
            // Redis操作失败时记录但不抛出异常
            $this->logger->warning(trans('asr.api.redis.save_task_status_failed'), [
                'task_key' => $taskStatus->taskKey ?? 'unknown',
                'user_id' => $taskStatus->userId ?? 'unknown',
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * 获取并验证任务状态 - 包含安全检查.
     *
     * @throws InvalidArgumentException
     */
    public function getAndValidateTaskStatus(string $taskKey, string $userId): AsrTaskStatusDTO
    {
        // 从Redis获取任务状态
        $taskStatus = $this->getTaskStatusFromRedis($taskKey, $userId);

        if ($taskStatus->isEmpty()) {
            throw new InvalidArgumentException(trans('asr.api.validation.upload_audio_first'));
        }

        // 校验目录是否属于当前用户（额外的安全检查）- 使用STS完整目录进行验证
        $this->validateDirectoryOwnership($taskStatus->stsFullDirectory, $userId);

        return $taskStatus;
    }

    /**
     * 下载并合并音频文件（公共方法）.
     *
     * @param string $organizationCode 组织编码
     * @param string $businessDirectory 业务目录
     * @param string $taskKey 任务键
     * @return string 本地合并后的音频文件路径
     * @throws InvalidArgumentException
     */
    protected function downloadAndMergeAudio(string $organizationCode, string $businessDirectory, string $taskKey): string
    {
        // 1. 下载所有音频文件到本地
        $localAudioFiles = $this->downloadAudioFiles($organizationCode, $businessDirectory, $taskKey);
        if (empty($localAudioFiles)) {
            throw new InvalidArgumentException('audio_file_not_found');
        }

        // 2. 合并音频文件
        return $this->mergeAudioFiles($localAudioFiles, $taskKey);
    }

    /**
     * 下载指定目录下的音频文件.
     *
     * @param string $organizationCode 组织编码
     * @param string $remoteDirectory 远程目录路径
     * @param string $taskKey 任务键
     * @return string[] 本地文件路径列表
     * @throws InvalidArgumentException
     */
    private function downloadAudioFiles(string $organizationCode, string $remoteDirectory, string $taskKey): array
    {
        // 创建本地运行时目录
        $runtimeDir = sprintf('%s/runtime/asr/%s', BASE_PATH, $taskKey);
        if (! is_dir($runtimeDir) && ! mkdir($runtimeDir, 0755, true) && ! is_dir($runtimeDir)) {
            throw new InvalidArgumentException('创建本地目录失败');
        }

        $localFiles = [];

        try {
            // 复用getAudioFileList获取所有音频文件，然后过滤出数字命名的分片文件
            $allAudioFiles = $this->getAudioFileList($organizationCode, $remoteDirectory);

            // 过滤出数字命名的音频文件（临时分片文件）
            $audioFiles = array_filter($allAudioFiles, static function (CloudFileInfoDTO $file) {
                $filename = $file->getFilename();
                return preg_match('/^\d+\..+$/', $filename);
            });

            if (empty($audioFiles)) {
                throw new InvalidArgumentException(sprintf(
                    '在目录中未找到音频文件: %s (组织编码: %s)',
                    $remoteDirectory,
                    $organizationCode
                ));
            }

            // 下载所有音频文件
            foreach ($audioFiles as $audioFile) {
                $objectKey = $audioFile->getKey();
                $filename = $audioFile->getFilename();
                $localFilePath = sprintf('%s/%s', $runtimeDir, $filename);

                try {
                    // 使用fileAppService下载文件
                    $this->fileAppService->downloadByChunks(
                        $organizationCode,
                        $objectKey,
                        $localFilePath,
                        StorageBucketType::SandBox->value
                    );

                    // 验证文件下载成功且不为空
                    if (file_exists($localFilePath) && filesize($localFilePath) > 0) {
                        $localFiles[] = $localFilePath;
                    } else {
                        throw new InvalidArgumentException(sprintf('下载的文件为空: %s', $filename));
                    }
                } catch (Throwable $downloadError) {
                    throw new InvalidArgumentException(
                        sprintf('下载音频文件失败 %s: %s', $filename, $downloadError->getMessage())
                    );
                }
            }

            return $localFiles;
        } catch (Throwable $e) {
            throw new InvalidArgumentException(sprintf('下载音频文件失败: %s', $e->getMessage()));
        }
    }

    /**
     * 获取ASR录音目录下的音频文件列表.
     *
     * @param string $organizationCode 组织编码
     * @param string $businessDirectory 业务目录
     * @return CloudFileInfoDTO[] 音频文件列表
     */
    private function getAudioFileList(string $organizationCode, string $businessDirectory): array
    {
        try {
            // 复用统一的文件列表获取方法
            $allFiles = $this->listAllFilesInBusinessDirectory($organizationCode, $businessDirectory);

            // 过滤出音频文件（支持常见音频格式）
            return array_filter($allFiles, static function (CloudFileInfoDTO $file) {
                $filename = $file->getFilename();
                return preg_match('/\.(webm|mp3|wav|m4a|ogg|aac|flac)$/i', $filename);
            });
        } catch (Throwable $e) {
            $this->logger->warning('ASR音频文件列表查询失败', [
                'organization_code' => $organizationCode,
                'business_directory' => $businessDirectory,
                'error' => $e->getMessage(),
            ]);
            return [];
        }
    }

    /**
     * 列出业务目录下的所有文件（用于清理）.
     *
     * @param string $organizationCode 组织编码
     * @param string $businessDirectory 业务目录
     * @return CloudFileInfoDTO[] 所有文件列表
     */
    private function listAllFilesInBusinessDirectory(string $organizationCode, string $businessDirectory): array
    {
        try {
            $directoryPrefix = trim($businessDirectory, '/');
            // 获取目录下的所有文件（不进行过滤）
            return $this->fileDomainService->getFilesFromCloudStorage(
                $organizationCode,
                $directoryPrefix,
                StorageBucketType::SandBox
            );
        } catch (Throwable $e) {
            $this->logger->warning('业务目录文件列表查询失败', [
                'organization_code' => $organizationCode,
                'business_directory' => $businessDirectory,
                'error' => $e->getMessage(),
            ]);
            return [];
        }
    }

    /**
     * 合并音频文件为一个完整文件.
     *
     * @param array $audioFiles 音频文件路径列表
     * @param string $taskKey 任务键
     * @return string 合并后文件路径
     * @throws InvalidArgumentException
     */
    private function mergeAudioFiles(array $audioFiles, string $taskKey): string
    {
        if (empty($audioFiles)) {
            throw new InvalidArgumentException('没有音频文件可合并');
        }

        $runtimeDir = sprintf('%s/runtime/asr/%s', BASE_PATH, $taskKey);
        $outputFile = sprintf('%s/merged_audio.webm', $runtimeDir);

        // 如果只有一个文件，直接返回该文件路径
        if (count($audioFiles) === 1) {
            // 复制文件到目标位置
            if (! copy($audioFiles[0], $outputFile)) {
                throw new InvalidArgumentException('复制单个音频文件失败');
            }
            return $outputFile;
        }

        // 多个文件需要合并 - 使用FFmpeg
        $ffmpegPath = $this->findFFmpegPath();
        if (! $ffmpegPath) {
            throw new InvalidArgumentException('未找到FFmpeg，无法合并音频文件。请安装FFmpeg: brew install ffmpeg (macOS) 或 apt-get install ffmpeg (Ubuntu)');
        }

        return $this->mergeAudioWithFFmpeg($audioFiles, $taskKey, $ffmpegPath, $outputFile);
    }

    /**
     * 保存文件记录到项目文件表.
     */
    private function saveFileRecordToProject(SaveFileRecordToProjectDTO $dto): void
    {
        try {
            // 直接使用项目根目录作为父目录，不再创建专门的ASR目录
            $parentId = $this->ensureWorkspaceRootDirectoryExists($dto->organizationCode, $dto->projectId, $dto->userId);

            // 创建文件实体
            $taskFileEntity = new TaskFileEntity([
                'user_id' => $dto->userId,
                'organization_code' => $dto->organizationCode,
                'project_id' => (int) $dto->projectId,
                'topic_id' => 0,
                'task_id' => 0,
                'file_type' => 'user_upload',
                'file_name' => $dto->fileName,
                'file_extension' => $dto->fileExtension,
                'file_key' => $dto->fileKey,
                'file_size' => $dto->fileSize,
                'external_url' => '',
                'storage_type' => 'workspace', // 工作区存储类型
                'is_hidden' => false,
                'is_directory' => false,
                'sort' => 0,
                'parent_id' => $parentId, // 直接使用项目根目录ID
                'source' => 2, // 2-项目目录
                'metadata' => Json::encode([
                    'asr_task' => true,
                    'created_by' => 'asr_summary_api',
                    'created_at' => date('Y-m-d H:i:s'),
                ]),
            ]);

            // 插入或忽略（防重复）
            $this->taskFileDomainService->insertOrIgnore($taskFileEntity);
        } catch (Throwable $e) {
            // 保存文件记录失败只记录日志，不影响主流程
            $this->logger->error('保存文件记录到项目失败', [
                'project_id' => $dto->projectId,
                'file_key' => $dto->fileKey,
                'file_name' => $dto->fileName,
                'error' => $e->getMessage(),
                'stack_trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * 使用FFmpeg合并音频文件.
     *
     * @param array $audioFiles 音频文件路径列表
     * @param string $taskKey 任务键
     * @param string $ffmpegPath FFmpeg可执行路径
     * @param string $outputFile 输出文件路径
     * @return string 合并后文件路径
     * @throws InvalidArgumentException
     */
    private function mergeAudioWithFFmpeg(array $audioFiles, string $taskKey, string $ffmpegPath, string $outputFile): string
    {
        // 创建文件列表
        $listFile = sprintf('%s/runtime/asr/%s/file_list.txt', BASE_PATH, $taskKey);
        $listContent = '';
        foreach ($audioFiles as $file) {
            $listContent .= sprintf("file '%s'\n", str_replace("'", "'\"'\"'", $file));
        }

        if (! file_put_contents($listFile, $listContent)) {
            throw new InvalidArgumentException('创建文件列表失败');
        }

        // 删除可能存在的输出文件，避免FFmpeg询问覆盖
        if (file_exists($outputFile)) {
            unlink($outputFile);
        }

        // 执行合并命令（添加-y参数自动覆盖文件）
        $command = sprintf(
            '%s -y -f concat -safe 0 -i %s -c copy %s 2>&1',
            escapeshellcmd($ffmpegPath),
            escapeshellarg($listFile),
            escapeshellarg($outputFile)
        );

        $output = shell_exec($command);

        if (! file_exists($outputFile) || filesize($outputFile) === 0) {
            $this->logger->error('FFmpeg合并失败', [
                'command' => $command,
                'output' => $output,
                'output_file' => $outputFile,
            ]);
            throw new InvalidArgumentException(sprintf('音频文件合并失败: %s', $output ?? '未知错误'));
        }

        // 清理临时文件列表
        if (file_exists($listFile)) {
            unlink($listFile);
        }

        return $outputFile;
    }

    /**
     * 清理远程存储中的临时音频文件.
     *
     * 使用批量删除提高效率，静默处理删除失败的情况，不会影响主流程
     *
     * @param string $organizationCode 组织编码
     * @param string $businessDirectory 业务目录
     */
    private function cleanupRemoteAudioFiles(string $organizationCode, string $businessDirectory): void
    {
        // 获取目录下的音频文件列表
        $audioFiles = $this->getAudioFileList($organizationCode, $businessDirectory);
        if (empty($audioFiles)) {
            return;
        }

        // 收集需要删除的临时音频文件（分片文件和合并文件）
        $filesToDelete = [];
        foreach ($audioFiles as $audioFile) {
            $filename = $audioFile->getFilename();
            // 匹配数字命名的分片文件（如：1.webm, 2.webm）和合并文件（如：merged_1.webm）
            if (preg_match('/^(\d+|merged_\d+)\..+$/', $filename)) {
                $filesToDelete[] = $audioFile->getKey();
            }
        }

        // 使用通用删除方法
        $this->deleteRemoteFiles($organizationCode, $businessDirectory, $filesToDelete);
    }

    /**
     * 查找FFmpeg路径.
     */
    private function findFFmpegPath(): ?string
    {
        $possiblePaths = [
            '/usr/local/bin/ffmpeg',
            '/usr/bin/ffmpeg',
            '/opt/homebrew/bin/ffmpeg',
            '/opt/local/bin/ffmpeg', // MacPorts
            '/snap/bin/ffmpeg', // Ubuntu Snap
            'ffmpeg', // 系统PATH中
        ];

        foreach ($possiblePaths as $path) {
            if ($path === 'ffmpeg') {
                // 检查系统PATH
                $result = shell_exec('which ffmpeg 2>/dev/null || where ffmpeg 2>/dev/null');
                if ($result && trim($result)) {
                    return trim($result);
                }
            } elseif (is_executable($path)) {
                return $path;
            }
        }

        $this->logger->error('FFmpeg未找到，音频合并将失败', [
            'searched_paths' => $possiblePaths,
            'install_commands' => [
                'macOS' => 'brew install ffmpeg',
                'Ubuntu/Debian' => 'sudo apt-get install ffmpeg',
                'CentOS/RHEL' => 'sudo yum install ffmpeg',
                'Docker' => 'RUN apt-get update && apt-get install -y ffmpeg',
            ],
        ]);

        return null;
    }

    /**
     * 通用的远程文件删除方法（复用cleanupRemoteAudioFiles的删除逻辑）.
     *
     * @param string $organizationCode 组织编码
     * @param string $businessDirectory 业务目录
     * @param array $filesToDelete 要删除的文件key数组
     */
    private function deleteRemoteFiles(string $organizationCode, string $businessDirectory, array $filesToDelete): void
    {
        if (empty($filesToDelete)) {
            return;
        }

        try {
            // 使用批量删除提高效率（复用cleanupRemoteAudioFiles的逻辑）
            $prefix = ltrim($businessDirectory, '/');
            $result = $this->fileDomainService->deleteObjectsByCredential(
                $prefix,
                $organizationCode,
                $filesToDelete,
                StorageBucketType::SandBox
            );

            // 记录删除结果
            $deletedCount = count($result['deleted'] ?? []);
            $errorCount = count($result['errors'] ?? []);

            if ($errorCount > 0) {
                $this->logger->warning('批量删除OSS临时音频文件失败', [
                    'organization_code' => $organizationCode,
                    'business_directory' => $businessDirectory,
                    'files_to_delete' => $filesToDelete,
                    'deleted_count' => $deletedCount,
                    'error_count' => $errorCount,
                    'errors' => $result['errors'] ?? [],
                ]);
            }
        } catch (Throwable $e) {
            // 静默处理删除失败，不影响主流程
            $this->logger->warning('批量删除OSS临时音频文件异常', [
                'organization_code' => $organizationCode,
                'business_directory' => $businessDirectory,
                'files_to_delete' => $filesToDelete,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * 构建项目根目录下的文件键（直接位于项目workDir根目录）.
     */
    private function buildProjectRootFileKey(string $userId, string $projectId, string $fileName): string
    {
        $projectEntity = $this->projectDomainService->getProject((int) $projectId, $userId);
        $workDir = $projectEntity->getWorkDir();
        if (empty($workDir)) {
            throw new InvalidArgumentException(sprintf('项目 %s 的工作区目录为空', $projectId));
        }
        return sprintf('%s/%s', trim($workDir, '/'), $fileName);
    }

    /**
     * 校验目录是否属于当前用户.
     *
     * @param string $directory 要校验的目录路径
     * @param string $userId 当前用户ID
     * @throws InvalidArgumentException 当目录不属于当前用户时抛出异常
     */
    private function validateDirectoryOwnership(string $directory, string $userId): void
    {
        // 去除首尾空白字符
        $directory = trim($directory);

        // 规范化路径格式
        if (! str_starts_with($directory, '/')) {
            $directory = sprintf('/%s', $directory);
        }

        // 🔧 支持两种路径格式：
        // 1. 简化路径: /asr/recordings/.../
        // 2. 完整路径: /DT001/.../asr/recordings/.../
        $isValidAsrPath = false;

        if (str_starts_with($directory, '/asr/recordings')) {
            // 简化路径格式
            $isValidAsrPath = true;
        } elseif (str_contains($directory, '/asr/recordings')) {
            // 完整路径格式，包含组织编码前缀
            $isValidAsrPath = true;
        }

        if (! $isValidAsrPath) {
            throw new InvalidArgumentException(trans('asr.api.directory.invalid_asr_path'));
        }

        // 安全检查：防止路径遍历攻击
        if (str_contains($directory, '..')) {
            throw new InvalidArgumentException(trans('asr.api.directory.security_path_error'));
        }

        // 关键检查：目录路径必须包含当前用户ID，确保用户只能操作自己的目录
        if (! str_contains($directory, $userId)) {
            throw new InvalidArgumentException(trans('asr.api.directory.ownership_error'));
        }

        // 进一步验证：检查用户ID是否在合适的位置
        // 支持两种目录结构:
        // 1. 简化路径: /asr/recordings/{date}/{user_id}/{task_key}/...
        // 2. 完整路径: /DT001/.../asr/recordings/{date}/{user_id}/{task_key}/...
        $pathParts = explode('/', trim($directory, '/'));

        // 找到asr/recordings的位置
        $asrIndex = -1;
        for ($i = 0; $i < count($pathParts) - 1; ++$i) {
            if ($pathParts[$i] === 'asr' && $pathParts[$i + 1] === 'recordings') {
                $asrIndex = $i;
                break;
            }
        }

        if ($asrIndex === -1) {
            throw new InvalidArgumentException(trans('asr.api.directory.invalid_structure'));
        }

        // 检查asr/recordings之后是否有足够的路径段: date, user_id, task_key
        $remainingParts = array_slice($pathParts, $asrIndex + 2);
        if (count($remainingParts) < 3) {
            throw new InvalidArgumentException(trans('asr.api.directory.invalid_structure_after_recordings'));
        }

        // 检查用户ID是否出现在路径中的合理位置
        $userIdFound = false;
        foreach ($pathParts as $part) {
            if ($part === $userId) {
                $userIdFound = true;
                break;
            }
        }

        if (! $userIdFound) {
            throw new InvalidArgumentException(trans('asr.api.directory.user_id_not_found'));
        }
    }

    /**
     * 确保工作区根目录存在，如果不存在则创建.
     *
     * 使用TaskFileDomainService的findOrCreateProjectRootDirectory方法
     * 获取项目实际的根目录ID，确保层级关系正确
     *
     * @param string $organizationCode 组织代码
     * @param string $projectId 项目ID
     * @param string $userId 用户ID
     * @return int 项目工作区根目录的实际file_id
     */
    private function ensureWorkspaceRootDirectoryExists(string $organizationCode, string $projectId, string $userId): int
    {
        // 获取项目实体以获取workDir
        $projectEntity = $this->projectDomainService->getProject((int) $projectId, $userId);
        $workDir = $projectEntity->getWorkDir();

        if (empty($workDir)) {
            throw new InvalidArgumentException(sprintf('项目 %s 的工作区目录为空', $projectId));
        }

        // 使用TaskFileDomainService查找或创建项目根目录
        return $this->taskFileDomainService->findOrCreateProjectRootDirectory(
            (int) $projectId,
            $workDir,
            $userId,
            $organizationCode
        );
    }

    /**
     * 处理音频文件上传到工作区，不进行语音识别.
     * 直接下载、合并、上传到工作区根目录，避免中间步骤.
     */
    private function updateAudioToWorkspace(AsrTaskStatusDTO $taskStatus, string $organizationCode, string $projectId, string $userId): void
    {
        try {
            // 1. 使用公共方法下载并合并音频文件
            $mergedLocalAudioFile = $this->downloadAndMergeAudio($organizationCode, $taskStatus->businessDirectory, $taskStatus->taskKey);

            // 2. 准备上传到工作区根目录
            $fileName = sprintf('%s_%s.webm', trans('asr.file_names.merged_audio_prefix'), date('Ymd_His'));
            $workspaceFileKey = $this->buildProjectRootFileKey($userId, $projectId, $fileName);

            // 3. 直接上传合并文件到工作区
            $uploadFile = new UploadFile($mergedLocalAudioFile, '', $workspaceFileKey, false);
            $this->fileAppService->upload($organizationCode, $uploadFile, StorageBucketType::SandBox, false);
            $actualWorkspaceFileKey = $uploadFile->getKey();

            // 4. 保存文件记录到项目
            $fileSize = file_exists($mergedLocalAudioFile) ? filesize($mergedLocalAudioFile) : 0;
            $saveDto = new SaveFileRecordToProjectDTO(
                $organizationCode,
                $projectId,
                $actualWorkspaceFileKey,
                $fileName,
                $fileSize,
                pathinfo($fileName, PATHINFO_EXTENSION),
                $userId
            );
            $this->saveFileRecordToProject($saveDto);

            // 5. 获取文件访问URL
            $fileLink = $this->fileAppService->getLink($organizationCode, $actualWorkspaceFileKey, StorageBucketType::SandBox);
            $workspaceFileUrl = $fileLink ? $fileLink->getUrl() : '';

            // 6. 同时将合并文件也上传到业务目录（保持兼容性）
            $businessUploadResult = $this->uploadMergedAudioAndGetUrl($organizationCode, $mergedLocalAudioFile, $taskStatus->taskKey, $taskStatus->businessDirectory);

            // 7. 更新任务状态
            $taskStatus->mergedAudioFileKey = $businessUploadResult['file_key']; // 业务目录中的合并文件
            $taskStatus->workspaceFileKey = $actualWorkspaceFileKey; // 工作区中的合并文件
            $taskStatus->workspaceFileUrl = $workspaceFileUrl;
            $taskStatus->fileName = $fileName; // 保存文件名

            // 8. 清理本地临时文件和远程小文件
            $this->cleanupTaskFiles($taskStatus->taskKey, $organizationCode, $taskStatus->businessDirectory);

            // 标记任务已处理
            $taskStatus->updateStatus(AsrTaskStatusEnum::COMPLETED);
        } catch (Throwable $e) {
            // 异常时清理本地临时文件
            try {
                $this->cleanupTaskFiles($taskStatus->taskKey);
            } catch (Throwable) {
                // 静默处理清理失败
            }

            $this->logger->error('音频文件处理失败', [
                'task_key' => $taskStatus->taskKey,
                'error' => $e->getMessage(),
                'user_id' => $userId,
                'project_id' => $projectId,
            ]);

            throw new InvalidArgumentException(sprintf('音频文件处理失败: %s', $e->getMessage()));
        }
    }

    /**
     * 发送总结聊天消息.
     *
     * @param ProcessSummaryTaskDTO $dto 处理总结任务DTO
     * @param MagicUserAuthorization $userAuthorization 用户授权信息
     */
    private function sendSummaryChatMessage(ProcessSummaryTaskDTO $dto, MagicUserAuthorization $userAuthorization): void
    {
        try {
            // 构建聊天请求
            $chatRequest = $this->chatMessageAssembler->buildSummaryMessage($dto);

            // 发送聊天消息
            $this->magicChatMessageAppService->onChatMessage($chatRequest, $userAuthorization);
        } catch (Throwable $e) {
            $this->logger->error('发送聊天消息失败', [
                'task_key' => $dto->taskStatus->taskKey,
                'conversation_id' => $dto->conversationId,
                'chat_topic_id' => $dto->topicId,
                'error' => $e->getMessage(),
                'user_id' => $dto->userId,
            ]);
            return;
        }
    }
}

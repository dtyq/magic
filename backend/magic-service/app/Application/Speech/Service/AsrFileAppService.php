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
use App\Application\Speech\DTO\SummaryRequestDTO;
use App\Application\Speech\Enum\AsrTaskStatusEnum;
use App\Domain\Chat\DTO\Request\ChatRequest;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
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
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\MessageQueueDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectMemberDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Hyperf\Codec\Json;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
use RuntimeException;
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
        private TopicDomainService $topicDomainService,
        private MessageQueueDomainService $messageQueueDomainService,
        private Redis $redis,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('AsrFileAppService');
    }

    /**
     * 处理ASR总结任务的完整流程（包含聊天消息发送）.
     *
     * @param SummaryRequestDTO $summaryRequest 总结请求DTO
     * @param MagicUserAuthorization $userAuthorization 用户授权信息（包含用户ID和组织编码）
     * @return array 处理结果
     */
    public function processSummaryWithChat(
        SummaryRequestDTO $summaryRequest,
        MagicUserAuthorization $userAuthorization
    ): array {
        try {
            // 从用户授权信息中获取必要的用户数据
            $userId = $userAuthorization->getId();
            $organizationCode = $userAuthorization->getOrganizationCode();

            // 1. 通过SuperAgent话题ID获取话题实体，再获取对话ID
            $topicEntity = $this->topicDomainService->getTopicById((int) $summaryRequest->topicId);

            if ($topicEntity === null) {
                ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND);
            }

            // 验证话题权限
            if ($topicEntity->getUserId() !== $userId) {
                ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND);
            }

            $chatTopicId = $topicEntity->getChatTopicId();
            $conversationId = $this->magicChatDomainService->getConversationIdByTopicId($chatTopicId);

            // 2. 获取并验证任务状态（如果有workspace_file_path则跳过此步骤）
            $taskStatus = null;
            if (! $summaryRequest->hasWorkspaceFilePath()) {
                $taskStatus = $this->getAndValidateTaskStatus($summaryRequest->taskKey, $userId);
            }

            // 3. 验证项目权限 - 确保项目属于当前用户和组织
            $this->validateProjectAccess($summaryRequest->projectId, $userId, $organizationCode);

            // 4. 处理ASR总结任务（如果没有workspace_file_path）
            if ($taskStatus && ! $summaryRequest->hasWorkspaceFilePath() && ! $taskStatus->isTaskSubmitted()) {
                // 处理音频文件上传
                $this->updateAudioToWorkspace($taskStatus, $organizationCode, $summaryRequest->projectId, $userId);
            }

            // 5. 构建处理总结任务DTO用于发送聊天消息
            if ($summaryRequest->hasWorkspaceFilePath()) {
                // 使用workspace_file_path构建虚拟任务状态
                $taskStatus = $this->createVirtualTaskStatusFromWorkspaceFile($summaryRequest);
            }

            // 5.5. 处理note文件（如果有）- 放在任务状态确定之后
            if ($taskStatus && $summaryRequest->hasNote()) {
                $this->processNoteFile($summaryRequest, $taskStatus, $organizationCode, $userId);
            }
            $processSummaryTaskDTO = new ProcessSummaryTaskDTO(
                $taskStatus,
                $organizationCode,
                $summaryRequest->projectId,
                $userId,
                $summaryRequest->topicId, // SuperAgent话题ID
                $chatTopicId, // Chat话题ID
                $conversationId,
                $summaryRequest->modelId
            );

            // 6. 发送聊天消息模拟用户总结请求
            $this->sendSummaryChatMessage($processSummaryTaskDTO, $userAuthorization);

            // 7. 保存更新后的任务状态（在发送聊天消息后）
            $this->saveTaskStatusToRedis($taskStatus);

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
            $mergedResult = $this->downloadAndMergeAudio($organizationCode, $businessDirectory, $taskKey);
            $mergedAudioFile = $mergedResult['file_path'];

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
            $ext = strtolower(pathinfo($localAudioFile, PATHINFO_EXTENSION)) ?: 'webm';
            $filename = sprintf('merged_%s.%s', $taskKey, $ext);
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
     * 列出业务目录下的所有文件（公共接口）.
     *
     * @param string $organizationCode 组织编码
     * @param string $businessDirectory 业务目录
     * @return CloudFileInfoDTO[] 所有文件列表
     */
    public function listFilesInDirectory(string $organizationCode, string $businessDirectory): array
    {
        return $this->listAllFilesInBusinessDirectory($organizationCode, $businessDirectory);
    }

    /**
     * 生成ASR目录名（统一的目录名生成规则）.
     *
     * @return string ASR目录名
     */
    public function generateAsrDirectoryName(): string
    {
        return sprintf('%s_%s', trans('asr.directory.recordings_summary_folder'), date('Ymd_His'));
    }

    /**
     * 生成ASR文件的工作区相对目录.
     *
     * @param string $userId 用户ID
     * @param string $projectId 项目ID
     * @return string 工作区相对目录路径
     */
    public function getFileRelativeDir(string $userId, string $projectId): string
    {
        // 获取项目实体 (如果项目不存在会自动抛出 PROJECT_NOT_FOUND 异常)
        $projectEntity = $this->projectDomainService->getProject((int) $projectId, $userId);

        // 从项目实体获取工作区目录
        $workDir = $projectEntity->getWorkDir();
        if (empty($workDir)) {
            throw new InvalidArgumentException(sprintf('项目 %s 的工作区目录为空', $projectId));
        }

        // 使用统一的目录名生成规则
        $asrDirectoryName = $this->generateAsrDirectoryName();

        // 返回工作区相对目录
        return trim($workDir . '/' . $asrDirectoryName, '/');
    }

    /**
     * 下载并合并音频文件（公共方法）.
     *
     * @param string $organizationCode 组织编码
     * @param string $businessDirectory 业务目录
     * @param string $taskKey 任务键
     * @return array 包含合并文件路径和格式的数组 ['file_path' => string, 'format' => string]
     * @throws InvalidArgumentException|Throwable
     */
    protected function downloadAndMergeAudio(string $organizationCode, string $businessDirectory, string $taskKey): array
    {
        $processStartTime = microtime(true);

        try {
            // 1. 获取音频文件列表，用于格式检测
            $allAudioFiles = $this->getAudioFileList($organizationCode, $businessDirectory);
            $audioFiles = array_filter($allAudioFiles, static function (CloudFileInfoDTO $file) {
                $filename = $file->getFilename();
                return preg_match('/^\d+\..+$/', $filename);
            });

            if (empty($audioFiles)) {
                throw new InvalidArgumentException('audio_file_not_found');
            }

            // 2. 检测主要音频格式
            $dominantFormat = $this->detectDominantAudioFormat($audioFiles);

            // 3. 下载所有音频文件到本地
            $localAudioFiles = $this->downloadAudioFiles($organizationCode, $businessDirectory, $taskKey);
            if (empty($localAudioFiles)) {
                throw new InvalidArgumentException('audio_file_not_found');
            }

            // 4. 合并音频文件
            $mergedFile = $this->mergeAudioFiles($localAudioFiles, $taskKey, $dominantFormat);

            return ['file_path' => $mergedFile, 'format' => $dominantFormat];
        } catch (Throwable $e) {
            $totalDuration = round((microtime(true) - $processStartTime) * 1000, 2);

            $this->logger->error('ASR音频下载合并流程失败', [
                'task_key' => $taskKey,
                'organization_code' => $organizationCode,
                'business_directory' => $businessDirectory,
                'error' => $e->getMessage(),
                'total_duration_ms' => $totalDuration,
            ]);

            throw $e;
        }
    }

    /**
     * 检测音频文件的主要格式（用于决定合并后的文件格式）.
     *
     * @param CloudFileInfoDTO[] $audioFiles 音频文件列表
     * @return string 主要文件格式扩展名
     */
    private function detectDominantAudioFormat(array $audioFiles): string
    {
        $formatCount = [];

        foreach ($audioFiles as $audioFile) {
            $filename = $audioFile->getFilename();
            $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

            if (in_array($extension, ['webm', 'mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac'])) {
                $formatCount[$extension] = ($formatCount[$extension] ?? 0) + 1;
            }
        }

        if (empty($formatCount)) {
            return 'webm'; // 默认格式
        }

        // 返回出现次数最多的格式
        arsort($formatCount);
        return array_key_first($formatCount);
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
                    $this->logger->error('下载音频文件失败', [
                        'task_key' => $taskKey,
                        'filename' => $filename,
                        'object_key' => $objectKey,
                        'local_path' => $localFilePath,
                        'error' => $downloadError->getMessage(),
                    ]);

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
     * 合并音频文件为一个完整文件 - 直接二进制拼接.
     *
     * @param array $audioFiles 音频文件路径列表
     * @param string $taskKey 任务键
     * @param string $format 目标文件格式扩展名
     * @return string 合并后文件路径
     * @throws InvalidArgumentException
     */
    private function mergeAudioFiles(array $audioFiles, string $taskKey, string $format = 'webm'): string
    {
        if (empty($audioFiles)) {
            throw new InvalidArgumentException('没有音频文件可合并');
        }

        $runtimeDir = sprintf('%s/runtime/asr/%s', BASE_PATH, $taskKey);
        $outputFile = sprintf('%s/merged_audio.%s', $runtimeDir, $format);

        // 按文件名数字顺序排序
        usort($audioFiles, static function (string $a, string $b): int {
            $aNum = (int) pathinfo(basename($a), PATHINFO_FILENAME);
            $bNum = (int) pathinfo(basename($b), PATHINFO_FILENAME);
            return $aNum <=> $bNum;
        });

        // 如果只有一个文件，直接复制
        if (count($audioFiles) === 1) {
            $sourceFile = $audioFiles[0];

            if (! copy($sourceFile, $outputFile)) {
                throw new InvalidArgumentException('复制单个音频文件失败');
            }

            return $outputFile;
        }

        // 分组并规范化：先将 WebM 容器 + 其 Cluster 续段二进制拼接为完整文件，再用 ffmpeg 无损合并
        try {
            $runtimeDir = sprintf('%s/runtime/asr/%s', BASE_PATH, $taskKey);
            $normalizedParts = $this->normalizeSegmentsToValidContainers($audioFiles, $taskKey, $format, $runtimeDir);

            if (empty($normalizedParts)) {
                throw new InvalidArgumentException('没有可用于合并的有效音频片段');
            }

            if (count($normalizedParts) === 1) {
                // 只有一个完整文件，直接复制为输出
                $single = $normalizedParts[0];
                if (! copy($single, $outputFile)) {
                    throw new InvalidArgumentException('复制单个规范化音频失败');
                }

                return $outputFile;
            }

            // 使用无损remux进行合并
            $ffmpegMerged = $this->mergeAudioFilesWithFfmpeg($normalizedParts, $taskKey, $outputFile);
            if ($ffmpegMerged !== null) {
                return $ffmpegMerged;
            }

            // 最后兜底：二进制合并（注意：仅当所有片段原本可直接二进制拼接时才可播放）
            $this->logger->warning('ffmpeg合并失败，兜底尝试二进制拼接所有规范化文件', [
                'task_key' => $taskKey,
            ]);
            return $this->mergeAudioFilesBinary($normalizedParts, $taskKey, $outputFile);
        } catch (Throwable $e) {
            $this->logger->warning('分组规范化/ffmpeg流程异常，兜底使用二进制拼接原始片段', [
                'task_key' => $taskKey,
                'error' => $e->getMessage(),
            ]);
            return $this->mergeAudioFilesBinary($audioFiles, $taskKey, $outputFile);
        }
    }

    /**
     * 保存文件记录到项目文件表.
     */
    private function saveFileRecordToProject(SaveFileRecordToProjectDTO $dto): void
    {
        try {
            // 从文件key中提取目录路径
            $directoryPath = dirname($dto->fileKey);

            // 确保目录在数据库中存在，获取目录ID
            $parentId = $this->ensureAsrRecordingsDirectoryExists($dto->organizationCode, $dto->projectId, $dto->userId, $directoryPath);

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
                'parent_id' => $parentId, // 使用ASR录音目录ID
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
     * 直接二进制合并音频文件.
     *
     * @param array $audioFiles 音频文件路径列表
     * @param string $taskKey 任务键
     * @param string $outputFile 输出文件路径
     * @throws InvalidArgumentException
     */
    private function mergeAudioFilesBinary(array $audioFiles, string $taskKey, string $outputFile): string
    {
        try {
            // 删除可能存在的输出文件
            if (file_exists($outputFile)) {
                unlink($outputFile);
            }

            // 打开输出文件进行写入
            $outputHandle = fopen($outputFile, 'wb');
            if ($outputHandle === false) {
                throw new InvalidArgumentException('无法创建输出文件');
            }

            $processedFiles = 0;

            // 逐个读取并写入文件
            foreach ($audioFiles as $inputFile) {
                if (! file_exists($inputFile)) {
                    $this->logger->warning('输入文件不存在，跳过', [
                        'task_key' => $taskKey,
                        'input_file' => basename($inputFile),
                    ]);
                    continue;
                }

                $inputHandle = fopen($inputFile, 'rb');
                if ($inputHandle === false) {
                    $this->logger->warning('无法打开输入文件，跳过', [
                        'task_key' => $taskKey,
                        'input_file' => basename($inputFile),
                    ]);
                    continue;
                }

                // 以块的方式复制文件内容
                while (! feof($inputHandle)) {
                    $chunk = fread($inputHandle, 8192); // 8KB chunks
                    if ($chunk !== false) {
                        $written = fwrite($outputHandle, $chunk);
                        if ($written === false) {
                            fclose($inputHandle);
                            fclose($outputHandle);
                            throw new InvalidArgumentException('写入输出文件失败');
                        }
                    }
                }

                fclose($inputHandle);
            }

            fclose($outputHandle);

            // 验证输出文件
            if (! file_exists($outputFile) || filesize($outputFile) === 0) {
                throw new InvalidArgumentException('合并后的文件为空或不存在');
            }

            return $outputFile;
        } catch (Throwable $e) {
            $this->logger->error('二进制合并失败', [
                'task_key' => $taskKey,
                'error' => $e->getMessage(),
                'output_file' => basename($outputFile),
                'processed_files' => $processedFiles ?? 0,
            ]);

            // 清理可能的部分输出文件
            if (isset($outputHandle) && is_resource($outputHandle)) {
                fclose($outputHandle);
            }
            if (file_exists($outputFile)) {
                unlink($outputFile);
            }

            throw new InvalidArgumentException(sprintf('音频文件二进制合并失败: %s', $e->getMessage()));
        }
    }

    /**
     * 使用ffmpeg进行容器级合并。
     * @param array $audioFiles 已排序的分段
     * @param string $taskKey 任务键
     * @param string $outputFile 最终输出文件路径（扩展名应与format匹配）
     * @return null|string 合并成功返回输出文件路径，失败返回null
     */
    private function mergeAudioFilesWithFfmpeg(array $audioFiles, string $taskKey, string $outputFile): ?string
    {
        try {
            $runtimeDir = sprintf('%s/runtime/asr/%s', BASE_PATH, $taskKey);

            // 使用无损concat demuxer合并
            $listFile = sprintf('%s/concat_list.txt', $runtimeDir);
            $lines = [];
            foreach ($audioFiles as $path) {
                $real = realpath($path) ?: $path;
                $lines[] = sprintf("file '%s'", str_replace("'", "'\\''", $real));
            }
            $content = implode("\n", $lines);
            if (file_put_contents($listFile, $content) === false) {
                $this->logger->warning('写入ffmpeg列表文件失败', [
                    'task_key' => $taskKey,
                    'list_file' => $listFile,
                ]);
                return null;
            }
            $cmd = sprintf(
                'ffmpeg -y -loglevel error -fflags +genpts -f concat -safe 0 -i %s -c copy %s',
                escapeshellarg($listFile),
                escapeshellarg($outputFile)
            );

            $output = [];
            $returnVar = 0;
            exec($cmd . ' 2>&1', $output, $returnVar);

            if ($returnVar !== 0 || ! file_exists($outputFile) || filesize($outputFile) === 0) {
                $this->logger->warning('ffmpeg合并失败', [
                    'task_key' => $taskKey,
                    'code' => $returnVar,
                    'output' => implode("\n", array_slice($output, -10)),
                ]);
                return null;
            }

            return $outputFile;
        } catch (Throwable $e) {
            $this->logger->warning('ffmpeg合并异常', [
                'task_key' => $taskKey,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * 读取文件头若干字节。
     */
    private function readHeadBytes(string $path): string
    {
        $handle = @fopen($path, 'rb');
        if ($handle === false) {
            return '';
        }
        $data = fread($handle, 4) ?: '';
        fclose($handle);
        return $data;
    }

    // 旧的按容器判断方法已统一到 canBinaryConcat()，已移除容器类型探测

    /**
     * WebM/Matroska EBML Header: 1A 45 DF A3.
     */
    private function isWebmContainerStart(string $path): bool
    {
        $head = $this->readHeadBytes($path);
        return $head !== '' && $head === hex2bin('1A45DFA3');
    }

    /**
     * WebM Cluster Element: 1F 43 B6 75.
     */
    private function isWebmClusterStart(string $path): bool
    {
        $head = $this->readHeadBytes($path);
        return $head !== '' && $head === hex2bin('1F43B675');
    }

    /**
     * 将片段规范化为一组"可独立播放"的容器文件：
     * - WebM: 以 EBML 头开头的文件作为新容器起点，之后连续的 Cluster 续段拼接到该容器；
     * - 其它：暂不做续段拼接，作为独立文件参与最终 ffmpeg 合并。
     */
    private function normalizeSegmentsToValidContainers(array $segments, string $taskKey, string $format, string $runtimeDir): array
    {
        $result = [];

        // 当前容器累积缓冲
        $currentGroup = [];
        $groupIndex = 0;

        $flushGroup = function () use (&$currentGroup, &$result, $taskKey, $runtimeDir, $format, &$groupIndex): void {
            if (count($currentGroup) === 0) {
                return;
            }
            if (count($currentGroup) === 1) {
                // 只有一个片段，直接加入
                $result[] = $currentGroup[0];
            } else {
                // 多个片段：默认用二进制拼接（适配"第一段有元数据，其余为续段"的场景）
                $tempOut = sprintf('%s/normalized_%s_%d.%s', $runtimeDir, $taskKey, $groupIndex, $format);

                $this->mergeAudioFilesBinary($currentGroup, $taskKey, $tempOut);
                $result[] = $tempOut;
            }
            $currentGroup = [];
            ++$groupIndex;
        };

        foreach ($segments as $index => $path) {
            $isContainer = $this->isWebmContainerStart($path);
            $isCluster = $this->isWebmClusterStart($path);

            if ($index === 0) {
                // 第一个片段：容器或非容器均作为起点
                $currentGroup[] = $path;
            } elseif ($isContainer) {
                // 新容器起点：先冲掉上一组
                $flushGroup();
                $currentGroup[] = $path;
            } elseif ($isCluster) {
                // WebM 续段：加入当前组
                $currentGroup[] = $path;
            } else {
                // 其它未知：默认视为续段，加入当前组（更贴近浏览器分段续写的实际情况）
                $currentGroup[] = $path;
            }
        }

        // 冲掉最后一组
        $flushGroup();

        return $result;
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
     * 确保ASR录音目录存在，如果不存在则创建.
     *
     * @param string $organizationCode 组织代码
     * @param string $projectId 项目ID
     * @param string $userId 用户ID
     * @param string $directoryPath 目录路径
     * @return int ASR录音目录的实际file_id
     */
    private function ensureAsrRecordingsDirectoryExists(string $organizationCode, string $projectId, string $userId, string $directoryPath): int
    {
        // 直接使用传入的目录路径作为key
        $asrDirKey = $directoryPath;
        $asrDirName = basename($directoryPath);

        // 先查找是否已存在该目录
        $existingDir = $this->taskFileDomainService->getByProjectIdAndFileKey((int) $projectId, $asrDirKey);
        if ($existingDir !== null) {
            return $existingDir->getFileId();
        }

        // 确保项目工作区根目录存在
        $rootDirectoryId = $this->ensureWorkspaceRootDirectoryExists($organizationCode, $projectId, $userId);

        // 创建ASR录音目录实体
        $asrDirEntity = new TaskFileEntity([
            'user_id' => $userId,
            'organization_code' => $organizationCode,
            'project_id' => (int) $projectId,
            'topic_id' => 0,
            'task_id' => 0,
            'file_type' => 'directory',
            'file_name' => $asrDirName,
            'file_extension' => '',
            'file_key' => $asrDirKey,
            'file_size' => 0,
            'external_url' => '',
            'storage_type' => 'workspace',
            'is_hidden' => false,
            'is_directory' => true,
            'sort' => 0,
            'parent_id' => $rootDirectoryId,
            'source' => 2, // 2-项目目录
            'metadata' => Json::encode([
                'asr_directory' => true,
                'created_by' => 'asr_summary_api',
                'created_at' => date('Y-m-d H:i:s'),
            ]),
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        // 尝试插入，如果已存在则忽略
        $result = $this->taskFileDomainService->insertOrIgnore($asrDirEntity);

        // 如果插入成功，返回新创建的目录ID
        if ($result !== null) {
            return $result->getFileId();
        }

        // 如果插入被忽略（目录已存在），再次查找并返回现有目录ID
        $existingDir = $this->taskFileDomainService->getByProjectIdAndFileKey((int) $projectId, $asrDirKey);
        if ($existingDir !== null) {
            return $existingDir->getFileId();
        }

        throw new InvalidArgumentException(sprintf('无法创建或获取ASR录音目录，项目ID: %s', $projectId));
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
     * 直接下载、合并、上传到工作区的动态ASR录音目录，避免中间步骤.
     * 目录名格式：{录音纪要国际化名称}_Ymd_His.
     */
    private function updateAudioToWorkspace(AsrTaskStatusDTO $taskStatus, string $organizationCode, string $projectId, string $userId): void
    {
        try {
            // 1. 使用公共方法下载并合并音频文件
            $mergedResult = $this->downloadAndMergeAudio($organizationCode, $taskStatus->businessDirectory, $taskStatus->taskKey);
            $mergedLocalAudioFile = $mergedResult['file_path'];
            $audioFormat = $mergedResult['format'];

            // 2. 准备上传到工作区指定目录（动态ASR录音目录）
            $fileName = sprintf('%s.%s', trans('asr.file_names.original_recording'), $audioFormat);
            $fileRelativeDir = $this->getFileRelativeDir($userId, $projectId);

            // 3. 直接上传合并文件到工作区的动态ASR录音目录
            $uploadFile = new UploadFile($mergedLocalAudioFile, $fileRelativeDir, $fileName, false);
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
            $fileWorkspaceRelativePath = rtrim($fileRelativeDir, '/') . '/' . $fileName;
            $taskStatus->mergedAudioFileKey = $businessUploadResult['file_key']; // 业务目录中的合并文件
            $taskStatus->workspaceFileKey = $actualWorkspaceFileKey; // 工作区中的合并文件
            $taskStatus->workspaceFileUrl = $workspaceFileUrl;
            $taskStatus->filePath = $fileWorkspaceRelativePath; // 保存工作区文件路径
            $taskStatus->workspaceRelativeDir = $fileRelativeDir; // 保存工作区相对目录，供note文件使用
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
     * 从workspace_file_path创建虚拟任务状态.
     *
     * @param SummaryRequestDTO $summaryRequest 总结请求DTO
     * @return AsrTaskStatusDTO 虚拟任务状态DTO
     */
    private function createVirtualTaskStatusFromWorkspaceFile(SummaryRequestDTO $summaryRequest): AsrTaskStatusDTO
    {
        $workspaceFilePath = $summaryRequest->workspaceFilePath;

        // 创建虚拟任务状态，用于构建聊天消息
        return new AsrTaskStatusDTO([
            'task_key' => $summaryRequest->taskKey,
            'user_id' => '', // 这里会在调用处设置
            'business_directory' => $summaryRequest->getWorkspaceDirectory(),
            'sts_full_directory' => $summaryRequest->getWorkspaceDirectory(),
            'status' => AsrTaskStatusEnum::COMPLETED->value, // 直接标记为已完成
            'workspace_file_key' => $workspaceFilePath,
            'workspace_file_url' => '', // 这里可以为空，因为不需要下载URL
            'file_path' => $workspaceFilePath, // 传入完整的工作区文件路径
        ]);
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

            // 检查话题状态，决定是直接发送消息还是写入队列
            $shouldQueueMessage = $this->shouldQueueMessage($dto->topicId);
            if ($shouldQueueMessage) {
                // 话题状态为waiting或running，将消息写入队列
                $this->queueChatMessage($dto, $chatRequest, $userAuthorization);
            } else {
                // 话题状态不是waiting/running，直接发送聊天消息
                $this->magicChatMessageAppService->onChatMessage($chatRequest, $userAuthorization);
            }
        } catch (Throwable $e) {
            $this->logger->error('发送聊天消息失败', [
                'task_key' => $dto->taskStatus->taskKey,
                'conversation_id' => $dto->conversationId,
                'topic_id' => $dto->topicId, // SuperAgent话题ID
                'chat_topic_id' => $dto->chatTopicId, // Chat话题ID
                'error' => $e->getMessage(),
                'user_id' => $dto->userId,
            ]);
            return;
        }
    }

    /**
     * 处理note文件生成和上传.
     *
     * @param SummaryRequestDTO $summaryRequest 总结请求DTO
     * @param AsrTaskStatusDTO $taskStatus 任务状态DTO
     * @param string $organizationCode 组织编码
     * @param string $userId 用户ID
     */
    private function processNoteFile(
        SummaryRequestDTO $summaryRequest,
        AsrTaskStatusDTO $taskStatus,
        string $organizationCode,
        string $userId
    ): void {
        try {
            // 1. 生成临时文件
            $tempDir = sys_get_temp_dir();
            $noteFileName = $summaryRequest->getNoteFileName();
            $tempFilePath = sprintf('%s/%s', rtrim($tempDir, '/'), $noteFileName);

            // 2. 写入note内容到临时文件
            $bytesWritten = file_put_contents($tempFilePath, $summaryRequest->note->content);

            if ($bytesWritten === false) {
                throw new RuntimeException(sprintf('写入note文件失败: %s', $tempFilePath));
            }

            // 3. 获取工作区相对目录（与音频文件保持一致）
            $fileRelativeDir = $taskStatus->workspaceRelativeDir;
            if (empty($fileRelativeDir)) {
                // 如果任务状态中没有保存目录，尝试从已有的音频文件路径中提取
                if (! empty($taskStatus->filePath)) {
                    // 从已有的工作区文件路径中提取目录
                    $fileRelativeDir = dirname($taskStatus->filePath);
                } else {
                    // 如果没有已有路径，则生成新的（fallback逻辑）
                    $fileRelativeDir = $this->getFileRelativeDir($userId, $summaryRequest->projectId);
                }
                $taskStatus->workspaceRelativeDir = $fileRelativeDir; // 保存到DTO中
            }

            // 4. 构建上传文件对象，上传到工作区
            $uploadFile = new UploadFile($tempFilePath, $fileRelativeDir, $noteFileName, false);

            // 5. 上传文件到工作区
            $this->fileAppService->upload($organizationCode, $uploadFile, StorageBucketType::SandBox, false);
            $actualWorkspaceFileKey = $uploadFile->getKey();

            // 6. 保存文件记录到项目 task_files 表
            $saveDto = new SaveFileRecordToProjectDTO(
                $organizationCode,
                $summaryRequest->projectId,
                $actualWorkspaceFileKey,
                $noteFileName,
                $bytesWritten,
                $summaryRequest->note->getFileExtension(),
                $userId
            );
            $this->saveFileRecordToProject($saveDto);

            // 标记任务状态中存在note文件
            $taskStatus->hasNoteFile = true;

            // 7. 删除本地临时文件
            if (file_exists($tempFilePath)) {
                unlink($tempFilePath);
            }
        } catch (Throwable $e) {
            $this->logger->error('处理note文件失败', [
                'task_key' => $summaryRequest->taskKey,
                'error' => $e->getMessage(),
                'organization_code' => $organizationCode,
            ]);

            // 确保删除可能创建的临时文件
            if (isset($tempFilePath) && file_exists($tempFilePath)) {
                try {
                    unlink($tempFilePath);
                } catch (Throwable) {
                    // 静默处理删除失败
                }
            }

            throw new RuntimeException(sprintf('处理note文件失败: %s', $e->getMessage()));
        }
    }

    /**
     * 检查是否应该将消息写入队列.
     *
     * 当话题状态为WAITING或RUNNING时，消息需要写入队列处理
     *
     * @param string $topicId 话题ID
     * @return bool 是否应该队列处理
     * @throws InvalidArgumentException 当找不到话题时
     */
    private function shouldQueueMessage(string $topicId): bool
    {
        // 创建数据隔离对象
        // 通过SuperAgent话题ID获取话题实体
        $topicEntity = $this->topicDomainService->getTopicById((int) $topicId);

        if ($topicEntity === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND);
        }

        // 检查话题的当前任务状态是否为waiting或running（需要队列处理）
        $currentStatus = $topicEntity->getCurrentTaskStatus();
        return $currentStatus !== null && ($currentStatus === TaskStatus::WAITING || $currentStatus === TaskStatus::RUNNING);
    }

    /**
     * 将聊天消息写入消息队列.
     *
     * @param ProcessSummaryTaskDTO $dto 处理总结任务DTO
     * @param ChatRequest $chatRequest 聊天请求对象（在队列情况下不使用，保留参数用于兼容）
     * @param MagicUserAuthorization $userAuthorization 用户授权信息
     */
    private function queueChatMessage(ProcessSummaryTaskDTO $dto, ChatRequest $chatRequest, MagicUserAuthorization $userAuthorization): void
    {
        // 创建数据隔离对象
        $dataIsolation = DataIsolation::create(
            $userAuthorization->getOrganizationCode(),
            $userAuthorization->getId()
        );

        // 通过SuperAgent话题ID获取话题实体
        $topicEntity = $this->topicDomainService->getTopicById((int) $dto->topicId);
        if ($topicEntity === null) {
            throw new InvalidArgumentException(sprintf('未找到话题ID: %s', $dto->topicId));
        }
        $messageContent = $chatRequest->getData()->getMessage()->getMagicMessage()->toArray();
        // 写入消息队列
        $this->messageQueueDomainService->createMessage(
            $dataIsolation,
            (int) $dto->projectId, // 转换为int类型
            $topicEntity->getId(), // 使用SuperAgent话题的数据库ID
            $messageContent,
            ChatMessageType::RichText // ASR总结消息使用富文本类型
        );
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Asr\Facade;

use App\Application\Asr\DTO\DownloadMergedAudioResponseDTO;
use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Application\File\Service\FileAppService;
use App\Application\Speech\DTO\NoteDTO;
use App\Application\Speech\DTO\SummaryRequestDTO;
use App\Application\Speech\Enum\AsrTaskStatusEnum;
use App\Application\Speech\Service\AsrFileAppService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\ExternalAPI\Volcengine\DTO\AsrTaskStatusDTO;
use App\Infrastructure\Util\Asr\Service\ByteDanceSTSService;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Exception;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\HttpServer\Annotation\Controller;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use Psr\Log\LoggerInterface;
use Swow\Psr7\Message\UploadedFile;
use Throwable;

use function Hyperf\Translation\trans;

#[Controller]
#[ApiResponse('low_code')]
class AsrTokenApi extends AbstractApi
{
    private LoggerInterface $logger;

    public function __construct(
        protected ByteDanceSTSService $stsService,
        protected FileAppService $fileAppService,
        protected Redis $redis,
        protected AsrFileAppService $asrFileAppService,
        protected LockerInterface $locker,
        protected MagicChatMessageAppService $magicChatMessageAppService,
        LoggerFactory $loggerFactory,
        RequestInterface $request,
    ) {
        $this->logger = $loggerFactory->get('AsrTokenApi');
        parent::__construct($request);
    }

    /**
     * 获取当前用户的ASR JWT Token
     * GET /api/v1/asr/tokens.
     * @throws Exception
     */
    public function show(RequestInterface $request): array
    {
        $userAuthorization = $this->getAuthorization();
        $magicId = $userAuthorization->getMagicId();

        // 获取请求参数
        $refresh = (bool) $request->input('refresh', false);

        // duration最大 12小时
        $duration = 60 * 60 * 12; // 单位：秒

        // 获取用户的JWT token（带缓存和刷新功能）
        $tokenData = $this->stsService->getJwtTokenForUser($magicId, $duration, $refresh);

        return [
            'token' => $tokenData['jwt_token'],
            'app_id' => $tokenData['app_id'],
            'duration' => $tokenData['duration'],
            'expires_at' => $tokenData['expires_at'],
            'resource_id' => $tokenData['resource_id'],
            'user' => [
                'user_id' => $userAuthorization->getId(),
                'magic_id' => $userAuthorization->getMagicId(),
                'organization_code' => $userAuthorization->getOrganizationCode(),
            ],
        ];
    }

    /**
     * 清除当前用户的ASR JWT Token缓存
     * DELETE /api/v1/asr/tokens.
     */
    public function destroy(): array
    {
        $userAuthorization = $this->getAuthorization();
        $magicId = $userAuthorization->getMagicId();

        // 清除用户的JWT Token缓存
        $cleared = $this->stsService->clearUserJwtTokenCache($magicId);

        return [
            'cleared' => $cleared,
            'message' => $cleared ? trans('asr.api.token.cache_cleared') : trans('asr.api.token.cache_not_exist'),
            'user' => [
                'user_id' => $userAuthorization->getId(),
                'magic_id' => $userAuthorization->getMagicId(),
                'organization_code' => $userAuthorization->getOrganizationCode(),
            ],
        ];
    }

    /**
     * 录音文件上传服务,debug 使用.
     * @deprecated
     *
     * @param RequestInterface $request 包含 task_key 和文件数据
     */
    public function uploadFile(RequestInterface $request): array
    {
        $userAuthorization = $this->getAuthorization();
        $userId = $userAuthorization->getId();
        $organizationCode = $userAuthorization->getOrganizationCode();

        // 获取task_key参数
        $taskKey = $request->input('task_key', '');
        if (empty($taskKey)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, trans('asr.api.validation.task_key_required'));
        }

        // 获取上传文件
        $file = $request->file('file');
        if (! $file instanceof UploadedFile) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, trans('asr.api.validation.file_required'));
        }

        // 验证任务是否存在且属于当前用户 - 委托给应用服务
        $taskStatus = $this->asrFileAppService->getAndValidateTaskStatus($taskKey, $userId);

        try {
            // 构建上传文件对象，使用业务目录作为文件键
            $filename = $file->getClientFilename() ?: 'audio.webm';
            $fileKey = rtrim($taskStatus->businessDirectory, '/') . '/' . $filename;
            $fileKey = ltrim($fileKey, '/');
            // 获取上传文件的临时路径
            $fileArray = $file->toArray();
            $uploadFile = new UploadFile($fileArray['tmp_file'], '', $fileKey, false);

            // 使用AsrFileAppService的专用上传方法
            $this->asrFileAppService->uploadFile($organizationCode, $uploadFile);

            return [
                'success' => true,
                'task_key' => $taskKey,
                'filename' => $filename,
                'file_key' => $fileKey,
                'file_size' => $file->getSize(),
                'upload_directory' => $taskStatus->businessDirectory,
                'message' => trans('asr.api.upload.success_message'),
                'user' => [
                    'user_id' => $userId,
                    'organization_code' => $organizationCode,
                ],
                'uploaded_at' => date('Y-m-d H:i:s'),
            ];
        } catch (Throwable $e) {
            $this->logger->error(trans('asr.api.upload.failed_log'), [
                'task_key' => $taskKey,
                'filename' => $filename ?? 'unknown',
                'error' => $e->getMessage(),
                'user_id' => $userId,
            ]);

            ExceptionBuilder::throw(GenericErrorCode::SystemError, trans('asr.api.upload.failed_exception', ['error' => $e->getMessage()]));
        }
    }

    /**
     * 查询录音总结状态
     * POST /api/v1/asr/summary.
     *
     * @param RequestInterface $request 包含 task_key、project_id、topic_id、model_id、workspace_file_path 和 note 参数
     */
    public function summary(RequestInterface $request): array
    {
        $userAuthorization = $this->getAuthorization();
        // 验证并获取请求参数
        $summaryRequest = $this->validateSummaryParams($request, $userAuthorization);

        // 生成锁名称和拥有者标识
        $lockName = sprintf('asr:summary:topic:%s', $summaryRequest->topicId);
        $lockOwner = sprintf('%s:%s:%s', $userAuthorization->getId(), $summaryRequest->taskKey, microtime(true));

        // 获取自旋锁，最多等待 30 秒
        $lockAcquired = false;
        try {
            $lockAcquired = $this->locker->spinLock($lockName, $lockOwner, 30);

            if (! $lockAcquired) {
                // 获取锁失败，返回错误
                return [
                    'success' => false,
                    'error' => trans('asr.api.lock.acquire_failed'),
                    'task_key' => $summaryRequest->taskKey,
                    'project_id' => $summaryRequest->projectId,
                    'topic_id' => $summaryRequest->topicId,
                    'project_name' => null,
                    'workspace_name' => null,
                ];
            }

            // 处理ASR总结任务的完整流程（包含聊天消息发送）
            $result = $this->asrFileAppService->processSummaryWithChat(
                $summaryRequest,
                $userAuthorization
            );

            // 如果处理失败，直接返回错误
            if (! $result['success']) {
                return [
                    'success' => false,
                    'error' => $result['error'],
                    'task_key' => $summaryRequest->taskKey,
                    'project_id' => $summaryRequest->projectId,
                    'topic_id' => $summaryRequest->topicId,
                    'project_name' => null,
                    'workspace_name' => null,
                ];
            }

            return [
                'success' => true,
                'task_key' => $summaryRequest->taskKey,
                'project_id' => $summaryRequest->projectId,
                'topic_id' => $summaryRequest->topicId,
                'conversation_id' => $result['conversation_id'],
                'project_name' => $result['project_name'] ?? null,
                'workspace_name' => $result['workspace_name'] ?? null,
            ];
        } catch (Throwable $e) {
            $this->logger->error('ASR总结处理异常', [
                'task_key' => $summaryRequest->taskKey,
                'topic_id' => $summaryRequest->topicId,
                'error' => $e->getMessage(),
                'user_id' => $userAuthorization->getId(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'error' => sprintf('处理异常: %s', $e->getMessage()),
                'task_key' => $summaryRequest->taskKey,
                'project_id' => $summaryRequest->projectId,
                'topic_id' => $summaryRequest->topicId,
                'project_name' => null,
                'workspace_name' => null,
            ];
        } finally {
            // 确保释放锁
            if ($lockAcquired) {
                $this->locker->release($lockName, $lockOwner);
            }
        }
    }

    /**
     * 获取合并后录音文件的下载URL
     * GET /api/v1/asr/download-url.
     *
     * @param RequestInterface $request 包含 task_key 参数
     */
    public function downloadMergedAudio(RequestInterface $request): array
    {
        $userAuthorization = $this->getAuthorization();
        $userId = $userAuthorization->getId();
        $organizationCode = $userAuthorization->getOrganizationCode();

        // 获取task_key参数
        $taskKey = $request->input('task_key', '');
        if (empty($taskKey)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, trans('asr.api.validation.task_key_required'));
        }

        // 获取并验证任务状态 - 委托给应用服务
        $taskStatus = $this->asrFileAppService->getAndValidateTaskStatus($taskKey, $userId);

        try {
            // 调用应用服务进行文件下载、合并、上传和注册删除
            $result = $this->asrFileAppService->downloadMergedAudio(
                $organizationCode,
                $taskStatus->businessDirectory,
                $taskKey
            );

            return DownloadMergedAudioResponseDTO::createSuccessResponse(
                $taskKey,
                $result['url'],
                $result['file_key'],
                $userId,
                $organizationCode
            )->toArray();
        } catch (Throwable $e) {
            // 处理业务异常
            if (str_contains($e->getMessage(), 'audio_file_not_found')) {
                return DownloadMergedAudioResponseDTO::createFailureResponse(
                    $taskKey,
                    $userId,
                    $organizationCode,
                    'asr.download.file_not_exist'
                )->toArray();
            }

            return DownloadMergedAudioResponseDTO::createFailureResponse(
                $taskKey,
                $userId,
                $organizationCode,
                'asr.download.get_link_error',
                null,
                ['error' => $e->getMessage()]
            )->toArray();
        }
    }

    /**
     * 获取ASR录音文件上传STS Token
     * GET /api/v1/asr/upload-tokens.
     *
     * @param RequestInterface $request 包含 task_key 参数
     */
    public function getUploadToken(RequestInterface $request): array
    {
        /** @var MagicUserAuthorization $userAuthorization */
        $userAuthorization = $this->getAuthorization();
        $userId = $userAuthorization->getId();
        $organizationCode = $userAuthorization->getOrganizationCode();

        // 获取task_key参数
        $taskKey = $request->input('task_key', '');
        if (empty($taskKey)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, trans('asr.api.validation.task_key_required'));
        }

        // 检查task_key是否已存在，如果存在则使用已有目录，如果不存在则生成新目录
        $taskStatus = $this->getTaskStatusFromRedis($taskKey, $userId);

        // 使用沙盒存储类型，适合临时录音文件
        $storageType = StorageBucketType::SandBox->value;
        $expires = 60 * 60;

        // 区分业务目录和STS完整目录
        if (! $taskStatus->isEmpty()) {
            // task_key已存在，使用已保存的业务目录重新获取STS Token
            $businessDirectory = $taskStatus->businessDirectory;
        } else {
            // task_key不存在，生成新的业务目录
            $businessDirectory = $this->generateAsrUploadDirectory($userId, $taskKey);
        }
        // 调用FileAppService获取STS Token（使用业务目录）
        $tokenData = $this->fileAppService->getStsTemporaryCredential(
            $userAuthorization,
            $storageType,
            $businessDirectory,
            $expires, // 最大有效期只能一个小时，前端需要报错重新获取
            false // 避免自动给 dir 加前缀导致不好查询目录下的文件
        );

        // 移除sts_token中的magic_service_host字段
        if (isset($tokenData['magic_service_host'])) {
            unset($tokenData['magic_service_host']);
        }

        // 🔧 获取STS返回的完整路径，用于前端上传
        if (empty($tokenData['temporary_credential']['dir'])) {
            // 记录详细的调试信息
            $this->logger->error(trans('asr.api.token.sts_get_failed'), [
                'task_key' => $taskKey,
                'business_directory' => $businessDirectory,
                'user_id' => $userId,
                'organization_code' => $organizationCode,
                'token_data_keys' => array_keys($tokenData),
                'temporary_credential_keys' => isset($tokenData['temporary_credential']) ? array_keys($tokenData['temporary_credential']) : 'not_exists',
            ]);
            ExceptionBuilder::throw(GenericErrorCode::SystemError, trans('asr.api.token.sts_get_failed'));
        }

        $stsFullDirectory = $tokenData['temporary_credential']['dir'];

        // 创建或更新任务状态，保存两个目录
        if ($taskStatus->isEmpty()) {
            // 新任务：创建任务状态
            $taskStatus = new AsrTaskStatusDTO([
                'task_key' => $taskKey,
                'user_id' => $userId,
                'business_directory' => $businessDirectory,  // 业务目录，与task_key绑定
                'sts_full_directory' => $stsFullDirectory,   // STS完整目录，用于前端上传
                'status' => AsrTaskStatusEnum::FAILED->value, // 初始设为失败，直至流程成功
            ]);
        } else {
            // 现有任务：更新STS完整目录
            $taskStatus->stsFullDirectory = $stsFullDirectory;   // 更新STS完整目录
        }

        // 保存更新的任务状态
        $this->saveTaskStatusToRedis($taskStatus);

        // 生成工作区目录名（调用统一的目录名生成方法）
        $workspaceDirectoryName = $this->asrFileAppService->generateAsrDirectoryName();

        return [
            'sts_token' => $tokenData,
            'task_key' => $taskKey,
            'upload_directory' => $stsFullDirectory,  // 使用STS完整路径
            'workspace_directory_name' => $workspaceDirectoryName,  // 新增：工作区目录名
            'expires_in' => $expires,
            'storage_type' => $storageType,
            'user' => [
                'user_id' => $userId,
                'magic_id' => $userAuthorization->getMagicId(),
                'organization_code' => $organizationCode,
            ],
            'usage_note' => trans('asr.api.token.usage_note'),
        ];
    }

    /**
     * 查询指定目录下的文件列表（测试接口）
     * POST /api/v1/asr/files.
     *
     * @param RequestInterface $request 包含 task_key 或 directory 参数
     */
    public function listObject(RequestInterface $request): array
    {
        $userAuthorization = $this->getAuthorization();
        $userId = $userAuthorization->getId();
        $organizationCode = $userAuthorization->getOrganizationCode();

        // 获取查询参数
        $taskKey = $request->input('task_key', '');
        $directory = $request->input('directory', '');

        // 确定查询目录：优先使用 task_key，其次使用 directory
        if (! empty($taskKey)) {
            // 通过 task_key 获取业务目录
            $taskStatus = $this->asrFileAppService->getAndValidateTaskStatus($taskKey, $userId);
            $businessDirectory = $taskStatus->businessDirectory;
        } elseif (! empty($directory)) {
            // 直接使用提供的目录
            $businessDirectory = trim($directory, '/');
        } else {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'task_key 或 directory 参数至少需要提供一个');
        }

        try {
            // 调用应用层服务获取文件列表
            $files = $this->asrFileAppService->listFilesInDirectory($organizationCode, $businessDirectory);

            // 转换为API响应格式
            $fileList = [];
            foreach ($files as $file) {
                $fileList[] = [
                    'file_key' => $file->getKey(),
                    'filename' => $file->getFilename(),
                    'size' => $file->getSize(),
                    'last_modified' => $file->getLastModified(),
                ];
            }

            return [
                'success' => true,
                'directory' => sprintf('/%s/', $businessDirectory),
                'file_count' => count($fileList),
                'files' => $fileList,
                'user' => [
                    'user_id' => $userId,
                    'organization_code' => $organizationCode,
                ],
                'queried_at' => date('Y-m-d H:i:s'),
            ];
        } catch (Throwable $e) {
            $this->logger->error('查询文件列表失败', [
                'task_key' => $taskKey,
                'directory' => $businessDirectory,
                'organization_code' => $organizationCode,
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'directory' => sprintf('/%s/', $businessDirectory),
                'error' => sprintf('查询文件列表失败：%s', $e->getMessage()),
                'user' => [
                    'user_id' => $userId,
                    'organization_code' => $organizationCode,
                ],
                'queried_at' => date('Y-m-d H:i:s'),
            ];
        }
    }

    /**
     * 调试：根据 task_key + user_id 查询 Redis 任务状态（测试环境专用）
     * GET /api/v1/asr/debug/task?task_key=xxx&user_id=yyy.
     */
    public function debugTaskStatus(RequestInterface $request): array
    {
        $taskKey = (string) $request->input('task_key', '');
        if ($taskKey === '') {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'task_key is required');
        }

        $userId = (string) $request->input('user_id', '');
        if ($userId === '') {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'user_id is required');
        }

        $redisKey = $this->generateTaskRedisKey($taskKey, $userId);

        try {
            $data = $this->redis->hGetAll($redisKey);
            $ttl = $this->redis->ttl($redisKey);
            $exists = ! empty($data);

            return [
                'success' => true,
                'task_key' => $taskKey,
                'user_id' => $userId,
                'redis_key' => $redisKey,
                'exists' => $exists,
                'ttl' => $exists ? $ttl : null, // -1: 永不过期; -2: 不存在
                'data' => $data,
                'queried_at' => date('Y-m-d H:i:s'),
            ];
        } catch (Throwable $e) {
            return [
                'success' => false,
                'task_key' => $taskKey,
                'user_id' => $userId,
                'redis_key' => $redisKey,
                'error' => $e->getMessage(),
                'queried_at' => date('Y-m-d H:i:s'),
            ];
        }
    }

    /**
     * 生成ASR录音文件专用上传目录.
     */
    private function generateAsrUploadDirectory(string $userId, string $taskKey): string
    {
        // 使用当前日期作为分区，便于管理和清理
        $currentDate = date('Y_m_d');

        // ASR录音文件目录结构: /asr/recordings/{date}/{user_id}/{task_key}/
        return sprintf('/asr/recordings/%s/%s/%s/', $currentDate, $userId, $taskKey);
    }

    /**
     * 从Redis获取任务状态.
     *
     * @param string $taskKey 任务键
     * @param string $userId 用户ID
     * @return AsrTaskStatusDTO 任务状态DTO
     */
    private function getTaskStatusFromRedis(string $taskKey, string $userId): AsrTaskStatusDTO
    {
        $redisKey = $this->generateTaskRedisKey($taskKey, $userId);

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
     */
    private function saveTaskStatusToRedis(AsrTaskStatusDTO $taskStatus): void
    {
        try {
            $redisKey = $this->generateTaskRedisKey($taskStatus->taskKey, $taskStatus->userId);

            // 保存任务状态数据
            $this->redis->hMSet($redisKey, $taskStatus->toArray());

            // 设置过期时间
            $this->redis->expire($redisKey, 43200);
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
     * 生成任务状态的统一Redis键名.
     *
     * @param string $taskKey 任务键
     * @param string $userId 用户ID
     * @return string Redis键名
     */
    private function generateTaskRedisKey(string $taskKey, string $userId): string
    {
        // 按统一规则生成字符串，然后MD5避免键名过长
        $keyString = $userId . ':' . $taskKey;
        $keyHash = md5($keyString);
        return sprintf('asr:task:%s', $keyHash);
    }

    /**
     * 验证 summary 请求参数.
     */
    private function validateSummaryParams(RequestInterface $request, MagicUserAuthorization $userAuthorization): SummaryRequestDTO
    {
        // 获取task_key参数
        $taskKey = $request->input('task_key', '');
        // 获取project_id参数（必传参数）
        $projectId = $request->input('project_id', '');
        // 获取topic_id参数（必传参数）
        $topicId = $request->input('topic_id', '');
        // 获取model_id参数（必传参数）
        $modelId = $request->input('model_id', '');
        // 获取workspace_file_path参数（可选参数）
        $workspaceFilePath = $request->input('workspace_file_path');
        // 获取note参数（可选参数）
        $noteData = $request->input('note');
        // 获取asr_stream_content（可选参数）
        $asrStreamContent = $request->input('asr_stream_content', '');

        // 限制 asr_stream_content 最大长度为 10000 字符
        if (! empty($asrStreamContent) && mb_strlen($asrStreamContent) > 10000) {
            $asrStreamContent = mb_substr($asrStreamContent, 0, 10000);
        }

        // 如果存在workspace_file_path且task_key为空，则生成UUID作为task_key
        if (! empty($workspaceFilePath) && empty($taskKey)) {
            $taskKey = uniqid('', true);
        }

        // 如果既没有task_key也没有workspace_file_path，则抛出异常
        if (empty($taskKey) && empty($workspaceFilePath)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, trans('asr.api.validation.task_key_required'));
        }

        if (empty($projectId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, trans('asr.api.validation.project_id_required'));
        }

        if (empty($topicId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, trans('asr.api.validation.topic_id_required'));
        }

        if (empty($modelId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, trans('asr.api.validation.model_id_required'));
        }

        // 处理note参数
        $note = null;
        if (! empty($noteData) && is_array($noteData)) {
            $noteContent = $noteData['content'] ?? '';

            // 只支持file_type字段，默认为md
            $noteFileType = $noteData['file_type'] ?? 'md';

            if (! empty(trim($noteContent))) {
                // 验证note内容长度，最大25000字符
                $contentLength = mb_strlen($noteContent);
                if ($contentLength > 25000) {
                    ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, trans('asr.api.validation.note_content_too_long', ['length' => $contentLength]));
                }

                $note = new NoteDTO($noteContent, $noteFileType);

                // 验证文件类型是否有效
                if (! $note->isValidFileType()) {
                    ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, sprintf('不支持的文件类型: %s，支持的类型: txt, md, json', $noteFileType));
                }
            }
        }

        // 生成标题（如果有流式识别文本）
        $generatedTitle = null;
        if (! empty($asrStreamContent)) {
            try {
                $language = di(TranslatorInterface::class)->getLocale();
                $title = $this->magicChatMessageAppService->summarizeText($userAuthorization, (string) $asrStreamContent, $language ?: 'zh_CN');
                $generatedTitle = $this->sanitizeTitleForPath($title);
            } catch (Throwable $e) {
                $this->logger->warning('ASR 流式文本生成标题失败', [
                    'task_key' => $taskKey,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return new SummaryRequestDTO($taskKey, $projectId, $topicId, $modelId, $workspaceFilePath, $note, $asrStreamContent ?: null, $generatedTitle);
    }

    /**
     * 生成安全的标题，移除文件/目录不允许的字符并截断长度.
     */
    private function sanitizeTitleForPath(string $title): ?string
    {
        $title = trim($title);
        // 移除非法字符 \/:*?"<>|
        $title = preg_replace('/[\\\\\/\:\*\?\"\<\>\|]/u', '', $title) ?? '';
        // 压缩空白
        $title = preg_replace('/\s+/u', ' ', $title) ?? '';
        // 限制长度，避免过长路径
        if (mb_strlen($title) > 50) {
            $title = mb_substr($title, 0, 50);
        }
        return $title ?: null;
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Asr\Facade;

use App\Application\Asr\DTO\DownloadMergedAudioResponseDTO;
use App\Application\File\Service\FileAppService;
use App\Application\Speech\DTO\ProcessSummaryTaskDTO;
use App\Application\Speech\Enum\AsrTaskStatusEnum;
use App\Application\Speech\Service\AsrFileAppService;
use App\Domain\File\Service\FileDomainService;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\ExternalAPI\Volcengine\DTO\AsrTaskStatusDTO;
use App\Infrastructure\Util\Asr\Service\ByteDanceSTSService;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Exception;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Annotation\Controller;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
use Swow\Psr7\Message\UploadedFile;
use Throwable;

use function Hyperf\Translation\trans;

#[Controller]
#[ApiResponse('low_code')]
class AsrTokenApi extends AbstractApi
{
    #[Inject]
    protected ByteDanceSTSService $stsService;

    #[Inject]
    protected FileAppService $fileAppService;

    #[Inject]
    protected FileDomainService $fileDomainService;

    #[Inject]
    protected Redis $redis;

    #[Inject]
    protected AsrFileAppService $asrFileAppService;

    #[Inject]
    protected LoggerFactory $loggerFactory;

    private LoggerInterface $logger;

    /**
     * 获取当前用户的ASR JWT Token
     * GET /api/v1/asr/tokens.
     * @throws Exception
     */
    public function show(RequestInterface $request): array
    {
        $userInfo = $this->getCurrentUserInfo();
        $magicId = $userInfo['magic_id'];

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
            'user' => $userInfo,
        ];
    }

    /**
     * 清除当前用户的ASR JWT Token缓存
     * DELETE /api/v1/asr/tokens.
     */
    public function destroy(): array
    {
        $userInfo = $this->getCurrentUserInfo();
        $magicId = $userInfo['magic_id'];

        // 清除用户的JWT Token缓存
        $cleared = $this->stsService->clearUserJwtTokenCache($magicId);

        return [
            'cleared' => $cleared,
            'message' => $cleared ? trans('asr.api.token.cache_cleared') : trans('asr.api.token.cache_not_exist'),
            'user' => $userInfo,
        ];
    }

    /**
     * ASR专用服务端代理文件上传
     * POST /api/v1/asr/upload.
     *
     * @param RequestInterface $request 包含 task_key 和文件数据
     */
    public function uploadFile(RequestInterface $request): array
    {
        $userInfo = $this->getCurrentUserInfo();
        $userId = $userInfo['user_id'];
        $organizationCode = $userInfo['organization_code'];

        // 获取task_key参数
        $taskKey = $request->input('task_key', '');
        if (empty($taskKey)) {
            throw new InvalidArgumentException(trans('asr.api.validation.task_key_required'));
        }

        // 获取上传文件
        $file = $request->file('file');
        if (! $file instanceof UploadedFile) {
            throw new InvalidArgumentException(trans('asr.api.validation.file_required'));
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

            $this->ensureLogger();

            $this->logger->info(trans('asr.api.upload.start_log'), [
                'task_key' => $taskKey,
                'filename' => $filename,
                'file_size' => $file->getSize(),
                'business_directory' => $taskStatus->businessDirectory,
                'file_key' => $fileKey,
                'user_id' => $userId,
                'organization_code' => $organizationCode,
            ]);

            // 使用AsrFileAppService的专用上传方法
            $this->asrFileAppService->uploadFile($organizationCode, $uploadFile);

            $this->logger->info(trans('asr.api.upload.success_log'), [
                'task_key' => $taskKey,
                'filename' => $filename,
                'file_key' => $fileKey,
                'user_id' => $userId,
            ]);

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
            $this->ensureLogger();

            $this->logger->error(trans('asr.api.upload.failed_log'), [
                'task_key' => $taskKey,
                'filename' => $filename ?? 'unknown',
                'error' => $e->getMessage(),
                'user_id' => $userId,
            ]);

            throw new InvalidArgumentException(trans('asr.api.upload.failed_exception', ['error' => $e->getMessage()]));
        }
    }

    /**
     * 直接查询录音状态 - 纯查询，不执行任何处理逻辑
     * GET /api/v1/asr/status.
     *
     * @param RequestInterface $request 包含 task_key 参数
     * @return array 返回任务状态信息，包含目录下的文件列表
     */
    public function queryStatus(RequestInterface $request): array
    {
        $userInfo = $this->getCurrentUserInfo();
        $userId = $userInfo['user_id'];
        $organizationCode = $userInfo['organization_code'];

        // 获取task_key参数
        $taskKey = $request->input('task_key', '');

        if (empty($taskKey)) {
            throw new InvalidArgumentException(trans('asr.api.validation.task_key_required'));
        }

        // 从Redis获取任务状态 - 委托给应用服务
        $taskStatus = $this->asrFileAppService->getTaskStatusFromRedis($taskKey, $userId);

        if ($taskStatus->isEmpty()) {
            return [
                'success' => false,
                'task_key' => $taskKey,
                'exists' => false,
                'message' => trans('asr.api.validation.task_not_exist'),
                'user' => $userInfo,
                'queried_at' => date('Y-m-d H:i:s'),
            ];
        }

        try {
            // 获取并验证任务状态（包含安全检查）
            $taskStatus = $this->asrFileAppService->getAndValidateTaskStatus($taskKey, $userId);
        } catch (InvalidArgumentException $e) {
            return [
                'success' => false,
                'task_key' => $taskKey,
                'exists' => false,
                'message' => $e->getMessage(),
                'user' => $userInfo,
                'queried_at' => date('Y-m-d H:i:s'),
            ];
        }

        // 获取目录下的文件列表
        $fileListData = $this->asrFileAppService->buildFileListResponse($organizationCode, $taskStatus->businessDirectory);

        return [
            'success' => true,
            'task_key' => $taskKey,
            'exists' => true,
            'directory' => $taskStatus->stsFullDirectory, // 返回STS完整目录
            'business_directory' => $taskStatus->businessDirectory, // 新增：业务目录
            'files' => $fileListData['files'],  // 新增：文件列表
            'file_count' => $fileListData['file_count'],  // 新增：文件数量
            'user' => [
                'user_id' => $userId,
                'organization_code' => $organizationCode,
            ],
            'status' => $taskStatus->status->value,
            'task_submitted' => $taskStatus->isTaskSubmitted(),
            'has_summary' => $taskStatus->status === AsrTaskStatusEnum::COMPLETED && ! empty($taskStatus->summaryContent),
            'summary_content' => $taskStatus->summaryContent,
            'created_at' => $taskStatus->createdAt,
            'updated_at' => $taskStatus->updatedAt,
            'queried_at' => date('Y-m-d H:i:s'),
        ];
    }

    /**
     * 查询录音总结状态 - 包含处理逻辑
     * GET /api/v1/asr/summary.
     *
     * @param RequestInterface $request 包含 task_key、project_id 和 retry 参数
     */
    public function summary(RequestInterface $request): array
    {
        $userInfo = $this->getCurrentUserInfo();
        $userId = $userInfo['user_id'];
        $organizationCode = $userInfo['organization_code'];

        // 验证并获取请求参数
        [$taskKey, $projectId, $retry] = $this->validateSummaryParams($request);

        // 获取并验证任务状态
        $taskStatus = $this->asrFileAppService->getAndValidateTaskStatus($taskKey, $userId);

        // 处理任务逻辑 - 委托给应用服务（包含项目权限校验）
        $processSummaryTaskDTO = new ProcessSummaryTaskDTO($taskStatus, $organizationCode, $projectId, $retry, $userId);
        $taskStatus = $this->asrFileAppService->processSummaryTask($processSummaryTaskDTO);

        // 保存更新后的任务状态
        $this->asrFileAppService->saveTaskStatusToRedis($taskStatus);

        // 获取目录下的文件列表（与status接口保持一致） - 使用业务目录查询
        $fileListData = $this->asrFileAppService->buildFileListResponse($organizationCode, $taskStatus->businessDirectory);

        return [
            'success' => true,
            'task_key' => $taskKey,
            'project_id' => $projectId, // 新增：返回项目ID
            'directory' => $taskStatus->stsFullDirectory, // 返回STS完整目录
            'business_directory' => $taskStatus->businessDirectory, // 新增：业务目录
            'files' => $fileListData['files'],  // 新增：文件列表
            'file_count' => $fileListData['file_count'],  // 新增：文件数量
            'user' => $userInfo,
            'summary_status' => $taskStatus->status->value,
            'has_summary' => $taskStatus->status === AsrTaskStatusEnum::COMPLETED && ! empty($taskStatus->summaryContent),
            'summary_content' => $taskStatus->summaryContent,
            'created_at' => $taskStatus->createdAt,
            'updated_at' => $taskStatus->updatedAt,
            'queried_at' => date('Y-m-d H:i:s'),
            'workspace_files_uploaded' => $taskStatus->status === AsrTaskStatusEnum::COMPLETED, // 新增：是否已上传到工作区
            'workspace_files_status' => $this->asrFileAppService->getWorkspaceFilesStatus($projectId, $taskStatus->taskKey, $taskStatus->status), // 新增：工作区文件状态详情
            'retry_requested' => $retry === 1, // 新增：是否请求了重新上传
        ];
    }

    /**
     * 获取合并后录音文件的下载URL
     * GET /api/v1/asr/download-url.
     *
     * @param RequestInterface $request 包含 task_key 参数
     */
    public function downloadMergedAudio(RequestInterface $request): array
    {
        $userInfo = $this->getCurrentUserInfo();
        $userId = $userInfo['user_id'];
        $organizationCode = $userInfo['organization_code'];

        // 获取task_key参数
        $taskKey = $request->input('task_key', '');
        if (empty($taskKey)) {
            throw new InvalidArgumentException(trans('asr.api.validation.task_key_required'));
        }

        // 获取并验证任务状态 - 委托给应用服务
        $taskStatus = $this->asrFileAppService->getAndValidateTaskStatus($taskKey, $userId);

        // 检查是否存在合并的音频文件
        if (empty($taskStatus->mergedAudioFileKey)) {
            return DownloadMergedAudioResponseDTO::createFailureResponse(
                $taskKey,
                $userId,
                $organizationCode,
                'asr.download.file_not_exist'
            )->toArray();
        }

        try {
            // 获取文件访问URL
            $fileLink = $this->fileAppService->getLink($organizationCode, $taskStatus->mergedAudioFileKey, StorageBucketType::SandBox);

            if (! $fileLink) {
                return DownloadMergedAudioResponseDTO::createFailureResponse(
                    $taskKey,
                    $userId,
                    $organizationCode,
                    'asr.download.get_link_failed',
                    $taskStatus->mergedAudioFileKey
                )->toArray();
            }

            return DownloadMergedAudioResponseDTO::createSuccessResponse(
                $taskKey,
                $fileLink->getUrl(),
                $taskStatus->mergedAudioFileKey,
                $userId,
                $organizationCode
            )->toArray();
        } catch (Throwable $e) {
            return DownloadMergedAudioResponseDTO::createFailureResponse(
                $taskKey,
                $userId,
                $organizationCode,
                'asr.download.get_link_error',
                $taskStatus->mergedAudioFileKey,
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
        $userInfo = $this->getCurrentUserInfo();
        $userId = $userInfo['user_id'];
        $organizationCode = $userInfo['organization_code'];

        /** @var MagicUserAuthorization $userAuthorization */
        $userAuthorization = $this->getAuthorization();

        // 获取task_key参数
        $taskKey = $request->input('task_key', '');
        if (empty($taskKey)) {
            throw new InvalidArgumentException(trans('asr.api.validation.task_key_required'));
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

            $this->ensureLogger();
            $this->logger->info(trans('asr.api.token.reuse_task_log'), [
                'task_key' => $taskKey,
                'business_directory' => $businessDirectory,
                'sts_full_directory' => $taskStatus->stsFullDirectory,
                'user_id' => $userId,
            ]);
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
            $this->ensureLogger();
            $this->logger->error(trans('asr.api.token.sts_get_failed'), [
                'task_key' => $taskKey,
                'business_directory' => $businessDirectory,
                'user_id' => $userId,
                'organization_code' => $organizationCode,
                'token_data_keys' => array_keys($tokenData),
                'temporary_credential_keys' => isset($tokenData['temporary_credential']) ? array_keys($tokenData['temporary_credential']) : 'not_exists',
            ]);
            throw new InvalidArgumentException(trans('asr.api.token.sts_get_failed'));
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
                'status' => AsrTaskStatusEnum::NOT_PROCESSED->value,
                'task_submitted' => false,
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
        } else {
            // 现有任务：更新STS完整目录
            $taskStatus->stsFullDirectory = $stsFullDirectory;   // 更新STS完整目录
            $taskStatus->updatedAt = date('Y-m-d H:i:s');
        }

        // 保存更新的任务状态
        $this->saveTaskStatusToRedis($taskStatus);

        return [
            'sts_token' => $tokenData,
            'task_key' => $taskKey,
            'upload_directory' => $stsFullDirectory,  // 使用STS完整路径
            'expires_in' => $expires,
            'storage_type' => $storageType,
            'user' => $userInfo,
            'usage_note' => trans('asr.api.token.usage_note'),
        ];
    }

    /**
     * 获取当前用户信息.
     */
    private function getCurrentUserInfo(): array
    {
        /** @var MagicUserAuthorization $userAuthorization */
        $userAuthorization = $this->getAuthorization();

        return [
            'user_id' => $userAuthorization->getId(),
            'magic_id' => $userAuthorization->getMagicId(),
            'organization_code' => $userAuthorization->getOrganizationCode(),
        ];
    }

    /**
     * 确保日志器已初始化.
     */
    private function ensureLogger(): void
    {
        if (! isset($this->logger)) {
            $this->logger = $this->loggerFactory->get('AsrTokenApi');
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
     * @param int $ttl 缓存过期时间（秒），默认12小时
     */
    private function saveTaskStatusToRedis(AsrTaskStatusDTO $taskStatus, int $ttl = 43200): void
    {
        try {
            $redisKey = $this->generateTaskRedisKey($taskStatus->taskKey, $taskStatus->userId);

            // 保存任务状态数据
            $this->redis->hMSet($redisKey, $taskStatus->toArray());

            // 设置过期时间
            $this->redis->expire($redisKey, $ttl);
        } catch (Throwable $e) {
            // Redis操作失败时记录但不抛出异常
            $this->ensureLogger();
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
     *
     * @return array [taskKey, projectId, retry]
     * @throws InvalidArgumentException
     */
    private function validateSummaryParams(RequestInterface $request): array
    {
        // 获取task_key参数
        $taskKey = $request->input('task_key', '');
        // 获取project_id参数（新增：必传参数）
        $projectId = $request->input('project_id', '');
        // 获取retry参数（新增：可选参数，1表示重新上传）
        $retry = (int) $request->input('retry', 0);

        if (empty($taskKey)) {
            throw new InvalidArgumentException(trans('asr.api.validation.task_key_required'));
        }

        if (empty($projectId)) {
            throw new InvalidArgumentException(trans('asr.api.validation.project_id_required'));
        }

        return [$taskKey, $projectId, $retry];
    }
}

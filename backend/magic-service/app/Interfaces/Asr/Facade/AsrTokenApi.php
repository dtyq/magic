<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Asr\Facade;

use App\Application\File\Service\FileAppService;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\Asr\Service\ByteDanceSTSService;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Annotation\Controller;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Redis\Redis;
use InvalidArgumentException;
use Throwable;

#[Controller]
#[ApiResponse('low_code')]
class AsrTokenApi extends AbstractApi
{
    #[Inject]
    protected ByteDanceSTSService $stsService;

    #[Inject]
    protected FileAppService $fileAppService;

    #[Inject]
    protected Redis $redis;

    /**
     * 获取当前用户的ASR JWT Token
     * GET /api/v1/asr/tokens.
     */
    public function show(RequestInterface $request): array
    {
        /** @var MagicUserAuthorization $userAuthorization */
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
                'magic_id' => $magicId,
                'user_id' => $userAuthorization->getId(),
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
        /** @var MagicUserAuthorization $userAuthorization */
        $userAuthorization = $this->getAuthorization();
        $magicId = $userAuthorization->getMagicId();

        // 清除用户的JWT Token缓存
        $cleared = $this->stsService->clearUserJwtTokenCache($magicId);

        return [
            'cleared' => $cleared,
            'message' => $cleared ? 'ASR Token缓存清除成功' : 'ASR Token缓存已不存在',
            'user' => [
                'magic_id' => $magicId,
                'user_id' => $userAuthorization->getId(),
                'organization_code' => $userAuthorization->getOrganizationCode(),
            ],
        ];
    }

    /**
     * 查询录音总结状态
     * GET /api/v1/asr/summary-status.
     *
     * @param RequestInterface $request 包含 task_key 参数
     */
    public function querySummaryStatus(RequestInterface $request): array
    {
        /** @var MagicUserAuthorization $userAuthorization */
        $userAuthorization = $this->getAuthorization();
        $userId = $userAuthorization->getId();
        $organizationCode = $userAuthorization->getOrganizationCode();

        // 获取task_key参数
        $taskKey = $request->input('task_key', '');

        if (empty($taskKey)) {
            throw new InvalidArgumentException('Task key parameter is required');
        }

        // 从Redis获取task_key对应的目录
        $directory = $this->getDirectoryByTaskKey($taskKey, $userId);

        if (empty($directory)) {
            throw new InvalidArgumentException('Task key not found or expired');
        }

        // 校验目录是否属于当前用户（额外的安全检查）
        $this->validateDirectoryOwnership($directory, $userId);

        // 从Redis查询总结状态
        $summaryStatus = $this->getSummaryStatusFromRedis($directory, $userId);

        return [
            'success' => true,
            'task_key' => $taskKey,
            'directory' => $directory,
            'user' => [
                'user_id' => $userId,
                'organization_code' => $organizationCode,
            ],
            'summary_status' => $summaryStatus['status'],
            'has_summary' => $summaryStatus['has_summary'],
            'summary_content' => $summaryStatus['summary_content'] ?? null,
            'created_at' => $summaryStatus['created_at'] ?? null,
            'updated_at' => $summaryStatus['updated_at'] ?? null,
            'queried_at' => date('Y-m-d H:i:s'),
        ];
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
            throw new InvalidArgumentException('Task key parameter is required');
        }

        // 检查task_key是否已存在，如果存在则使用已有目录，如果不存在则生成新目录
        $existingDirectory = $this->getDirectoryByTaskKey($taskKey, $userId);

        if (! empty($existingDirectory)) {
            // task_key已存在，使用已有目录
            $asrUploadDir = $existingDirectory;
        } else {
            // task_key不存在，生成新的默认目录
            $asrUploadDir = $this->generateAsrUploadDirectory($userId);
            // 将新的映射关系存储到Redis，缓存12小时
            $this->setTaskKeyDirectoryMapping($taskKey, $asrUploadDir, $userId);
        }

        // 使用沙盒存储类型，适合临时录音文件
        $storageType = StorageBucketType::SandBox->value;
        $expires = 60 * 60;
        // 调用FileAppService获取STS Token
        $tokenData = $this->fileAppService->getStsTemporaryCredential(
            $userAuthorization,
            $storageType,
            $asrUploadDir,
            $expires // 最大有效期只能一个小时，前端需要报错重新获取
        );

        // 移除sts_token中的magic_service_host字段
        if (isset($tokenData['magic_service_host'])) {
            unset($tokenData['magic_service_host']);
        }

        return [
            'sts_token' => $tokenData,
            'task_key' => $taskKey,
            'upload_directory' => $asrUploadDir,
            'expires_in' => $expires,
            'storage_type' => $storageType,
            'user' => [
                'user_id' => $userId,
                'organization_code' => $organizationCode,
            ],
            'usage_note' => '此Token专用于ASR录音文件分片上传，请将录音文件上传到指定目录中',
        ];
    }

    /**
     * 设置录音总结状态到Redis（供其他服务调用）.
     *
     * @param string $directory 录音目录
     * @param string $userId 用户ID
     * @param string $status 总结状态：processing, completed, failed
     * @param null|string $summaryContent 总结内容
     * @param int $ttl 缓存过期时间（秒），默认7天
     */
    public function setSummaryStatusToRedis(string $directory, string $userId, string $status, ?string $summaryContent = null, int $ttl = 604800): void
    {
        $redisKey = $this->generateSummaryRedisKey($directory, $userId);
        $currentTime = date('Y-m-d H:i:s');

        try {
            // 准备要存储的数据
            $data = [
                'status' => $status,
                'updated_at' => $currentTime,
                'directory' => $directory,
                'user_id' => $userId,
            ];

            // 如果是第一次设置，添加创建时间
            if (! $this->redis->exists($redisKey)) {
                $data['created_at'] = $currentTime;
            }

            // 如果提供了总结内容，添加到数据中
            if ($summaryContent !== null) {
                $data['summary_content'] = $summaryContent;
            }

            // 使用Hash存储数据
            $this->redis->hMSet($redisKey, $data);

            // 设置过期时间
            $this->redis->expire($redisKey, $ttl);
        } catch (Throwable $e) {
            // 记录错误但不抛出异常，避免影响主流程
            error_log('Failed to set summary status to Redis: ' . $e->getMessage());
        }
    }

    /**
     * 生成ASR录音文件专用上传目录.
     */
    private function generateAsrUploadDirectory(string $userId): string
    {
        // 使用当前日期作为分区，便于管理和清理
        $currentDate = date('Y_m_d');

        // ASR录音文件目录结构: /asr/recordings/{date}/{user_id}/
        return sprintf('/asr/recordings/%s/%s/', $currentDate, $userId);
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

        // 确保以 / 开头
        if (! str_starts_with($directory, '/')) {
            $directory = '/' . $directory;
        }

        // 确保目录以 /asr/recordings 开头
        if (! str_starts_with($directory, '/asr/recordings')) {
            throw new InvalidArgumentException('Directory must be under "/asr/recordings" path');
        }

        // 安全检查：防止路径遍历攻击
        if (strpos($directory, '..') !== false) {
            throw new InvalidArgumentException('Directory path cannot contain ".." for security reasons');
        }

        // 关键检查：目录路径必须包含当前用户ID，确保用户只能操作自己的目录
        if (strpos($directory, $userId) === false) {
            throw new InvalidArgumentException('Directory does not belong to current user');
        }

        // 进一步验证：检查用户ID是否在合适的位置
        // 期望的目录结构: /asr/recordings/{date}/{user_id}/... 或 /asr/recordings/{custom_path}/{user_id}/...
        $pathParts = explode('/', trim($directory, '/'));

        // 至少应该有: asr, recordings, 某个分区, user_id
        if (count($pathParts) < 4) {
            throw new InvalidArgumentException('Invalid directory structure');
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
            throw new InvalidArgumentException('User ID not found in directory path');
        }
    }

    /**
     * 从Redis获取录音总结状态.
     *
     * @param string $directory 录音目录
     * @param string $userId 用户ID
     * @return array 总结状态信息
     */
    private function getSummaryStatusFromRedis(string $directory, string $userId): array
    {
        // 生成Redis键，使用目录的MD5哈希来避免键名过长
        $redisKey = $this->generateSummaryRedisKey($directory, $userId);

        try {
            // 从Redis获取总结状态数据
            $summaryData = $this->redis->hGetAll($redisKey);

            if (empty($summaryData)) {
                // 如果Redis中没有数据，返回默认状态
                return [
                    'status' => 'not_processed',
                    'has_summary' => false,
                    'summary_content' => null,
                    'created_at' => null,
                    'updated_at' => null,
                ];
            }

            // 返回从Redis获取的数据
            return [
                'status' => $summaryData['status'] ?? 'not_processed',
                'has_summary' => ($summaryData['status'] ?? '') === 'completed',
                'summary_content' => $summaryData['summary_content'] ?? null,
                'created_at' => $summaryData['created_at'] ?? null,
                'updated_at' => $summaryData['updated_at'] ?? null,
            ];
        } catch (Throwable $e) {
            // Redis查询出错时，返回默认状态
            return [
                'status' => 'error',
                'has_summary' => false,
                'summary_content' => null,
                'created_at' => null,
                'updated_at' => null,
            ];
        }
    }

    /**
     * 生成总结状态的Redis键名.
     *
     * @param string $directory 录音目录
     * @param string $userId 用户ID
     * @return string Redis键名
     */
    private function generateSummaryRedisKey(string $directory, string $userId): string
    {
        // 使用前缀 + 用户ID + 目录MD5的格式
        $directoryHash = md5($directory);
        return "asr:summary:{$userId}:{$directoryHash}";
    }

    /**
     * 设置task_key和目录的映射关系到Redis.
     *
     * @param string $taskKey 任务键
     * @param string $directory 上传目录
     * @param string $userId 用户ID
     * @param int $ttl 缓存过期时间（秒），默认12小时
     */
    private function setTaskKeyDirectoryMapping(string $taskKey, string $directory, string $userId, int $ttl = 43200): void
    {
        $redisKey = $this->generateTaskKeyRedisKey($taskKey);

        // 存储映射数据
        $data = [
            'directory' => $directory,
            'user_id' => $userId,
            'created_at' => date('Y-m-d H:i:s'),
            'task_key' => $taskKey,
        ];

        // 使用Hash存储数据
        $this->redis->hMSet($redisKey, $data);

        // 设置12小时过期时间
        $this->redis->expire($redisKey, $ttl);
    }

    /**
     * 根据task_key获取对应的目录.
     *
     * @param string $taskKey 任务键
     * @param string $userId 用户ID（用于安全验证）
     * @return null|string 目录路径，如果不存在或已过期则返回null
     */
    private function getDirectoryByTaskKey(string $taskKey, string $userId): ?string
    {
        $redisKey = $this->generateTaskKeyRedisKey($taskKey);

        try {
            // 从Redis获取映射数据
            $mappingData = $this->redis->hGetAll($redisKey);

            if (empty($mappingData)) {
                return null;
            }

            // 安全检查：确保task_key属于当前用户
            if (($mappingData['user_id'] ?? '') !== $userId) {
                throw new InvalidArgumentException('Task key does not belong to current user');
            }

            return $mappingData['directory'] ?? null;
        } catch (Throwable $e) {
            // Redis查询出错或安全检查失败
            if ($e instanceof InvalidArgumentException) {
                throw $e; // 重新抛出安全相关异常
            }
            error_log('Failed to get directory by task key from Redis: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * 生成task_key映射关系的Redis键名.
     *
     * @param string $taskKey 任务键
     * @return string Redis键名
     */
    private function generateTaskKeyRedisKey(string $taskKey): string
    {
        // 使用前缀 + task_key的格式
        return "asr:taskkey:{$taskKey}";
    }
}

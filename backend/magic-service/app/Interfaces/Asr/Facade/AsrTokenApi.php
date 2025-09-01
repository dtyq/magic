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

#[Controller]
#[ApiResponse('low_code')]
class AsrTokenApi extends AbstractApi
{
    #[Inject]
    protected ByteDanceSTSService $stsService;

    #[Inject]
    protected FileAppService $fileAppService;

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
     * 获取ASR录音文件上传STS Token
     * GET /api/v1/asr/upload-tokens.
     */
    public function getUploadToken(RequestInterface $request): array
    {
        /** @var MagicUserAuthorization $userAuthorization */
        $userAuthorization = $this->getAuthorization();

        // 获取请求参数，默认 12 小时
        $expires = (int) $request->input('expires', 3600 * 12);
        $expires = min($expires, 3600 * 12);

        // 生成ASR录音文件专用目录
        $userId = $userAuthorization->getId();
        $organizationCode = $userAuthorization->getOrganizationCode();
        $asrUploadDir = $this->generateAsrUploadDirectory($userId);

        // 使用沙盒存储类型，适合临时录音文件
        $storageType = StorageBucketType::SandBox->value;

        // 调用FileAppService获取STS Token
        $tokenData = $this->fileAppService->getStsTemporaryCredential(
            $userAuthorization,
            $storageType,
            $asrUploadDir,
            $expires
        );

        return [
            'sts_token' => $tokenData,
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
     * 生成ASR录音文件专用上传目录.
     */
    private function generateAsrUploadDirectory(string $userId): string
    {
        // 使用当前日期作为分区，便于管理和清理
        $currentDate = date('Y/m/d');

        // ASR录音文件目录结构: /asr/recordings/{date}/{user_id}/
        return sprintf('/asr/recordings/%s/%s/', $currentDate, $userId);
    }
}

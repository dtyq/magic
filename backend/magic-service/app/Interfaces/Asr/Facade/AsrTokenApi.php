<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Asr\Facade;

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
}

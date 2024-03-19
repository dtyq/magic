<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Authentication\Facade;

use App\Application\Chat\Service\MagicUserContactAppService;
use App\Domain\Authentication\DTO\LoginCheckDTO;
use App\Infrastructure\Core\Contract\Session\SessionInterface;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Redis\Redis;

#[ApiResponse(version: 'low_code')]
class AuthenticationApi
{
    #[Inject]
    protected Redis $redis;

    #[Inject]
    protected MagicUserContactAppService $userAppService;

    #[Inject]
    protected SessionInterface $sessionInterface;

    public function authCheck(RequestInterface $request): array
    {
        // 根据登录码，获取对应的访问环境，去麦吉/天书校验是否有权限
        $authorization = (string) $request->input('authorization', '');
        if (empty($authorization)) {
            $authorization = (string) $request->header('authorization');
        }
        $organizationCode = $request->header('organization-code');
        $loginCode = (string) $request->input('login_code', '');
        $loginCheckDTO = new LoginCheckDTO();
        $loginCheckDTO->setAuthorization($authorization);
        $loginCheckDTO->setLoginCode($loginCode);
        $loginCheckDTO->setOrganizationCode($organizationCode);
        $magicEnvironmentEntity = $this->userAppService->getLoginCodeEnv($loginCheckDTO->getLoginCode());
        return $this->sessionInterface->LoginCheck($loginCheckDTO, $magicEnvironmentEntity, $loginCheckDTO->getOrganizationCode());
    }

    /**
     * 前端自身业务用，获取 authorization 对应的私有化识别码
     */
    public function authEnvironment(RequestInterface $request): array
    {
        $authorization = (string) $request->header('authorization');
        $magicEnvironmentEntity = $this->userAppService->getEnvByAuthorization($authorization);
        return [
            'login_code' => $magicEnvironmentEntity?->getEnvironmentCode(),
        ];
    }
}

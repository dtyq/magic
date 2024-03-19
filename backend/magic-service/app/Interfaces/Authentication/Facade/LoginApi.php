<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Authentication\Facade;

use App\Application\Authentication\Service\LoginAppService;
use App\Application\Chat\Service\MagicUserContactAppService;
use App\Interfaces\Authentication\DTO\CheckLoginRequest;
use App\Interfaces\Authentication\DTO\CheckLoginResponse;
use Hyperf\HttpServer\Contract\RequestInterface;

class LoginApi
{
    public function __construct(protected LoginAppService $loginAppService, protected MagicUserContactAppService $userAppService)
    {
    }

    /**
     * 验证用户登录.
     */
    public function login(RequestInterface $request): CheckLoginResponse
    {
        $stateCode = $request->input('state_code', '');
        // 去掉 +号
        $stateCode = str_replace('+', '', $stateCode);
        $loginRequest = new CheckLoginRequest();
        $loginRequest->setEmail($request->input('email', ''));
        $loginRequest->setPassword($request->input('password'));
        $loginRequest->setOrganizationCode($request->input('organization_code', ''));
        $loginRequest->setStateCode($stateCode);
        $loginRequest->setPhone($request->input('phone', ''));
        $loginRequest->setRedirect($request->input('redirect', ''));
        $loginRequest->setType($request->input('type', 'email_password'));

        return $this->loginAppService->login($loginRequest);
    }
}

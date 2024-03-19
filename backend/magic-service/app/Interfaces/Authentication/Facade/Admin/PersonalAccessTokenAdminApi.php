<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Authentication\Facade\Admin;

use App\Application\Authentication\Service\PersonalAccessTokenAppService;
use App\Interfaces\Authentication\Assembler\PersonalAccessTokenAssembler;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class PersonalAccessTokenAdminApi extends AbstractAuthenticationAdminApi
{
    #[Inject]
    protected PersonalAccessTokenAppService $tokenAppService;

    /**
     * 创建个人访问令牌.
     * 注意：token只会在创建时返回一次，请妥善保管.
     */
    public function createToken()
    {
        $authorization = $this->getAuthorization();
        $tokenEntity = $this->tokenAppService->createToken($authorization);
        return PersonalAccessTokenAssembler::toDTO($tokenEntity);
    }

    /**
     * 重置个人访问令牌.
     * 注意：重置后，旧token将立即失效.
     */
    public function resetToken()
    {
        $authorization = $this->getAuthorization();
        $tokenEntity = $this->tokenAppService->resetToken($authorization);
        return PersonalAccessTokenAssembler::toDTO($tokenEntity);
    }

    /**
     * 获取个人访问令牌信息（脱敏显示）.
     */
    public function getTokenInfo()
    {
        $authorization = $this->getAuthorization();
        $tokenEntity = $this->tokenAppService->getTokenInfo($authorization);
        return PersonalAccessTokenAssembler::toDTO($tokenEntity, true);
    }

    /**
     * 删除个人访问令牌.
     */
    public function deleteToken()
    {
        $authorization = $this->getAuthorization();
        $this->tokenAppService->deleteToken($authorization);
    }
}

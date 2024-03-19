<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Contract\Session;

use App\Domain\OrganizationEnvironment\Entity\MagicEnvironmentEntity;

interface SessionInterface
{
    /**
     * 麦吉对其他服务端发起的登录校验。如果想复用已有的用户体系,需要实现该接口.
     *
     * 实现流程：前端对非麦吉自建的账号体系进行登录请求,然后再请求麦吉的登录校验接口。
     *
     * @param LoginCheckInterface $loginCheck 登录校验数据
     * @param MagicEnvironmentEntity $magicEnvironmentEntity 要登录的环境
     * @param null|string $magicOrganizationCode 要登录的组织
     * @return LoginResponseInterface[] 登录响应数据
     */
    public function loginCheck(LoginCheckInterface $loginCheck, MagicEnvironmentEntity $magicEnvironmentEntity, ?string $magicOrganizationCode = null): array;
}

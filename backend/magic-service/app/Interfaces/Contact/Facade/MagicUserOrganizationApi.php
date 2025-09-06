<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Contact\Facade;

use App\Application\Contact\Service\MagicUserOrganizationAppService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\AbstractApi;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;

/**
 * 用户当前组织管理API.
 */
#[ApiResponse('low_code')]
class MagicUserOrganizationApi extends AbstractApi
{
    #[Inject]
    protected MagicUserOrganizationAppService $userOrganizationAppService;

    #[Inject]
    protected MagicUserDomainService $userDomainService;

    /**
     * 获取用户当前组织代码
     */
    public function getCurrentOrganizationCode(RequestInterface $request): array
    {
        // 从请求头获取 authorization
        $authorization = (string) $request->header('authorization', '');
        if ($authorization === '') {
            ExceptionBuilder::throw(UserErrorCode::ACCOUNT_ERROR);
        }

        $magicId = $this->getMagicIdByAuthorization($authorization);

        // 获取当前用户的组织代码
        return $this->userOrganizationAppService->getCurrentOrganizationCode($magicId);
    }

    /**
     * 设置用户当前组织代码
     */
    public function setCurrentOrganizationCode(RequestInterface $request): array
    {
        // 从请求头获取 authorization
        $authorization = (string) $request->header('authorization', '');
        if ($authorization === '') {
            ExceptionBuilder::throw(UserErrorCode::ACCOUNT_ERROR);
        }

        $magicId = $this->getMagicIdByAuthorization($authorization);

        // 从请求体获取组织代码
        $organizationCode = (string) $request->input('magic_organization_code', '');
        if (empty($organizationCode)) {
            ExceptionBuilder::throw(UserErrorCode::ORGANIZATION_NOT_EXIST);
        }

        // 设置用户当前组织代码
        return $this->userOrganizationAppService->setCurrentOrganizationCode($magicId, $organizationCode);
    }

    private function getMagicIdByAuthorization(string $authorization): string
    {
        $userDetails = $this->userDomainService->getUsersDetailByAccountFromAuthorization($authorization);
        if (empty($userDetails)) {
            ExceptionBuilder::throw(UserErrorCode::ACCOUNT_ERROR);
        }
        // 同一账号下 magic_id 全局唯一，这里取第一个即可
        return $userDetails[0]->getMagicId();
    }
}

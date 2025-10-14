<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade;

use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\SuperAgent\Service\ProjectInvitationLinkAppService;
use Hyperf\HttpServer\Contract\RequestInterface;

/**
 * 项目邀请链接API.
 *
 * 统一管理项目邀请链接的管理和访问功能
 */
#[ApiResponse('low_code')]
class ProjectInvitationLinkApi extends AbstractApi
{
    public function __construct(
        protected ProjectInvitationLinkAppService $invitationLinkAppService,
        protected RequestInterface $request,
    ) {
        parent::__construct($request);
    }

    /**
     * 获取项目邀请链接信息.
     */
    public function getInvitationLink(RequestContext $requestContext, string $projectId): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        return $this->invitationLinkAppService->getInvitationLink($requestContext, $projectId);
    }

    /**
     * 开启/关闭邀请链接.
     */
    public function toggleInvitationLink(RequestContext $requestContext, string $projectId): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        $enabled = (bool) $this->request->input('enabled', false);

        return $this->invitationLinkAppService->toggleInvitationLink($requestContext, $projectId, $enabled);
    }

    /**
     * 重置邀请链接.
     */
    public function resetInvitationLink(RequestContext $requestContext, string $projectId): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        return $this->invitationLinkAppService->resetInvitationLink($requestContext, $projectId);
    }

    /**
     * 设置密码保护.
     */
    public function setPassword(RequestContext $requestContext, string $projectId): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        $request = $this->request->all();
        $enabled = $request['enabled'] ?? false; // 提取参数
        return $this->invitationLinkAppService->setPassword($requestContext, $projectId, $enabled);
    }

    /**
     * 重新设置密码
     */
    public function resetPassword(RequestContext $requestContext, string $projectId): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        return $this->invitationLinkAppService->resetPassword($requestContext, $projectId);
    }

    /**
     * 修改权限级别.
     */
    public function updatePermission(RequestContext $requestContext, string $projectId): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        $request = $this->request->all();
        $permission = $request['permission'] ?? 'view'; // 提取参数
        return $this->invitationLinkAppService->updatePermission($requestContext, $projectId, $permission);
    }

    /**
     * 通过Token访问邀请链接（外部用户预览）.
     */
    public function getInvitationByToken(RequestContext $requestContext, string $token): array
    {
        // 外部用户访问，但仍需要设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        return $this->invitationLinkAppService->getInvitationByToken($token);
    }

    /**
     * 加入项目（外部用户操作）.
     */
    public function joinProject(RequestContext $requestContext): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        $request = $this->request->all();
        $token = $request['token'] ?? ''; // 提取参数
        $password = $request['password'] ?? null; // 提取参数
        return $this->invitationLinkAppService->joinProject($requestContext, $token, $password);
    }
}

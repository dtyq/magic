<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade;

use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\SuperAgent\Service\FileEditingAppService;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class FileEditingApi extends AbstractApi
{
    public function __construct(
        private readonly FileEditingAppService $fileEditingAppService,
        protected RequestInterface $request,
    ) {
        parent::__construct($request);
    }

    /**
     * 加入编辑.
     */
    public function joinEditing(RequestContext $requestContext, string $fileId): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 调用应用服务
        $this->fileEditingAppService->joinEditing($requestContext, (int) $fileId);

        return [];
    }

    /**
     * 离开编辑.
     */
    public function leaveEditing(RequestContext $requestContext, string $fileId): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 调用应用服务
        $this->fileEditingAppService->leaveEditing($requestContext, (int) $fileId);

        return [];
    }

    /**
     * 获取编辑用户数量.
     */
    public function getEditingUsers(RequestContext $requestContext, string $fileId): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 调用应用服务
        $userCount = $this->fileEditingAppService->getEditingUsers($requestContext, (int) $fileId);

        return [
            'editing_user_count' => $userCount,
        ];
    }
}

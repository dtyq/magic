<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Share\Facade;

use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Dtyq\SuperMagic\Application\Share\Service\ResourceShareAppService;
use Dtyq\SuperMagic\Domain\Share\Event\CancelShareAfterEvent;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Request\CreateShareRequestDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Request\GetShareDetailDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Request\ResourceListRequestDTO;
use Exception;
use Hyperf\HttpServer\Contract\RequestInterface;
use Qbhy\HyperfAuth\AuthManager;

#[ApiResponse('low_code')]
class ShareApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        protected ResourceShareAppService $shareAppService,
    ) {
    }

    /**
     * 创建资源分享.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 分享信息
     * @throws BusinessException 如果参数无效或操作失败则抛出异常
     * @throws Exception
     */
    public function createShare(RequestContext $requestContext): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());
        $userAuthorization = $requestContext->getUserAuthorization();

        $dto = CreateShareRequestDTO::fromRequest($this->request);
        $data = $this->shareAppService->createShare($userAuthorization, $dto);

        return $data->toArray();
    }

    /**
     * 取消资源分享.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param string $id 分享ID
     * @return array 取消结果
     * @throws BusinessException 如果参数无效或操作失败则抛出异常
     * @throws Exception
     */
    public function cancelShare(RequestContext $requestContext, string $id): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());
        $userAuthorization = $requestContext->getUserAuthorization();

        $this->shareAppService->cancelShare($userAuthorization, (int) $id);

        AsyncEventUtil::dispatch(new CancelShareAfterEvent($userAuthorization->getOrganizationCode(), $userAuthorization->getId(), $id));

        return [
            'id' => $id,
        ];
    }

    public function checkShare(RequestContext $requestContext, string $shareCode): array
    {
        // 尝试获取用户信息，但是有可能是访问，所以会为 null
        try {
            $requestContext->setUserAuthorization(di(AuthManager::class)->guard(name: 'web')->user());
            $userAuthorization = $requestContext->getUserAuthorization();
        } catch (Exception $exception) {
            $userAuthorization = null;
        }
        return $this->shareAppService->checkShare($userAuthorization, $shareCode);
    }

    public function getShareDetail(RequestContext $requestContext, string $shareCode): array
    {
        // 尝试获取用户信息，但是有可能是访问，所以会为 null
        try {
            $requestContext->setUserAuthorization(di(AuthManager::class)->guard(name: 'web')->user());
            $userAuthorization = $requestContext->getUserAuthorization();
        } catch (Exception $exception) {
            $userAuthorization = null;
        }
        $dto = GetShareDetailDTO::fromRequest($this->request);

        return $this->shareAppService->getShareDetail($userAuthorization, $shareCode, $dto);
    }

    public function getShareList(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());
        $userAuthorization = $requestContext->getUserAuthorization();

        $dto = ResourceListRequestDTO::fromRequest($this->request);
        return $this->shareAppService->getShareList($userAuthorization, $dto);
    }

    /**
     * 通过分享code获取分享信息.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param string $shareCode 分享code
     * @return array 分享信息
     * @throws BusinessException 如果参数无效或操作失败则抛出异常
     * @throws Exception
     */
    public function getShareByCode(RequestContext $requestContext, string $shareCode): array
    {
        // 尝试获取用户信息，但是有可能是访问，所以会为 null
        $requestContext->setUserAuthorization($this->getAuthorization());
        $userAuthorization = $requestContext->getUserAuthorization();

        // 直接调用包含明文密码的方法 - 在 /code/{shareCode} 路由中使用
        $dto = $this->shareAppService->getShareWithPasswordByCode($userAuthorization, $shareCode);

        return $dto->toArray();
    }
}

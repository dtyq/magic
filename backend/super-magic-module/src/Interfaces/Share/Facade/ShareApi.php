<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Share\Facade;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\Share\Service\ResourceShareAppService;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Request\BatchCancelShareRequestDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Request\CopyResourceFilesRequestDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Request\CreateShareRequestDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Request\FindSimilarShareRequestDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Request\GetFilesByIdsRequestDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Request\GetShareCopyLogsRequestDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Request\GetShareDetailDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Request\GetSharedProjectsTreeRequestDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Request\GetShareFilesRequestDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Request\GetShareStatisticsRequestDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Request\ResourceListRequestDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Response\GenerateResourceIdResponseDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\TaskFileItemDTO;
use Exception;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\RateLimit\Annotation\RateLimit;

#[ApiResponse('low_code')]
class ShareApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        protected ResourceShareAppService $shareAppService,
    ) {
    }

    /**
     * 生成资源ID.
     *
     * @return array 包含资源ID的数组
     */
    public function generateResourceId(): array
    {
        $dto = new GenerateResourceIdResponseDTO();
        $dto->id = (string) IdGenerator::getSnowId();

        return $dto->toArray();
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
        $requestContext->setUserAuthorization($this->getAuthorization());
        $userAuthorization = $requestContext->getUserAuthorization();

        $dto = CreateShareRequestDTO::fromRequest($this->request);
        return $this->shareAppService->createShare($userAuthorization, $dto)->toArray();
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
    public function cancelShareByResourceId(RequestContext $requestContext, string $id): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());
        $userAuthorization = $requestContext->getUserAuthorization();

        $this->shareAppService->cancelShareByResourceId($userAuthorization, $id);

        return [
            'id' => $id,
        ];
    }

    /**
     * 批量取消资源分享.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 批量取消结果
     * @throws BusinessException 如果参数无效或操作失败则抛出异常
     * @throws Exception
     */
    public function batchCancelShareByResourceIds(RequestContext $requestContext): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());
        $userAuthorization = $requestContext->getUserAuthorization();

        $dto = BatchCancelShareRequestDTO::fromRequest($this->request);

        return $this->shareAppService->batchCancelShareByResourceIds($userAuthorization, $dto);
    }

    /**
     * Check if share requires password.
     * Rate limited to prevent enumeration attacks.
     *
     * @param RequestContext $requestContext Request context
     * @param string $shareCode Share code
     * @return array Check result
     */
    #[RateLimit(create: 10, capacity: 20, key: 'share_check')]
    public function checkShare(RequestContext $requestContext, string $shareCode): array
    {
        // Try to get user info, but it may be null for anonymous access
        try {
            $requestContext->setUserAuthorization($this->getAuthorization());
            $userAuthorization = $requestContext->getUserAuthorization();
        } catch (Exception) {
            $userAuthorization = null;
        }
        return $this->shareAppService->checkShare($userAuthorization, $shareCode);
    }

    /**
     * Get share detail with password verification.
     * Rate limited to prevent brute force password attacks.
     *
     * @param RequestContext $requestContext Request context
     * @param string $shareCode Share code
     * @return array Share detail
     */
    #[RateLimit(create: 5, capacity: 10, key: 'share_detail')]
    public function getShareDetail(RequestContext $requestContext, string $shareCode): array
    {
        // Try to get user info, but it may be null for anonymous access
        try {
            $requestContext->setUserAuthorization($this->getAuthorization());
            $userAuthorization = $requestContext->getUserAuthorization();
        } catch (Exception) {
            $userAuthorization = null;
        }
        $dto = GetShareDetailDTO::fromRequest($this->request);

        return $this->shareAppService->getShareDetail($userAuthorization, $shareCode, $dto);
    }

    /**
     * 获取分享资源对应的文件列表.
     *
     * @param string $shareCode 分享code
     * @return array 文件列表及树结构
     * @throws BusinessException 如果参数无效或操作失败则抛出异常
     * @throws Exception
     */
    public function getShareFiles(string $shareCode): array
    {
        // 尝试获取用户信息，但是有可能是访问，所以会为 null
        try {
            $userAuthorization = $this->getAuthorization();
        } catch (Exception) {
            $userAuthorization = null;
        }
        $dto = GetShareFilesRequestDTO::fromRequest($this->request);

        return $this->shareAppService->getShareFiles($userAuthorization, $shareCode, $dto);
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

    /**
     * 复制资源文件到新项目.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 复制结果
     * @throws BusinessException 如果参数无效或操作失败则抛出异常
     * @throws Exception
     */
    public function copyResourceFiles(RequestContext $requestContext): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());
        $userAuthorization = $requestContext->getUserAuthorization();

        // 从请求创建 DTO
        $dto = CopyResourceFilesRequestDTO::fromRequest($this->request);

        // 调用 Application 层服务
        return $this->shareAppService->copyResourceFiles($userAuthorization, $dto);
    }

    /**
     * 根据文件ID列表查找分享（返回所有匹配的分享）.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 找到的所有分享信息数组，如果没有找到则返回空数组
     * @throws BusinessException 如果参数无效或操作失败则抛出异常
     * @throws Exception
     */
    public function findSimilarShare(RequestContext $requestContext): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());
        $userAuthorization = $requestContext->getUserAuthorization();

        // 从请求创建 DTO
        $dto = FindSimilarShareRequestDTO::fromRequest($this->request);

        // 调用 Application 层服务（已返回数组格式，包含 copy_count 字段）
        return $this->shareAppService->findSimilarShare($userAuthorization, $dto);
    }

    /**
     * 获取分享统计信息.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 统计信息
     * @throws BusinessException 如果参数无效或操作失败则抛出异常
     * @throws Exception
     */
    public function getShareStatistics(RequestContext $requestContext): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());
        $userAuthorization = $requestContext->getUserAuthorization();

        // 从请求创建 DTO
        $dto = GetShareStatisticsRequestDTO::fromRequest($this->request);

        // 调用 Application 层服务
        return $this->shareAppService->getShareStatistics($userAuthorization, $dto)->toArray();
    }

    /**
     * 获取分享复制记录.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 复制记录
     * @throws BusinessException 如果参数无效或操作失败则抛出异常
     * @throws Exception
     */
    public function getShareCopyLogs(RequestContext $requestContext): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());
        $userAuthorization = $requestContext->getUserAuthorization();

        // 从请求创建 DTO
        $dto = GetShareCopyLogsRequestDTO::fromRequest($this->request);

        // 调用 Application 层服务
        return $this->shareAppService->getShareCopyLogs($userAuthorization, $dto)->toArray();
    }

    /**
     * 获取分享成员列表.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param string $resourceId 资源ID
     * @return array 成员列表
     * @throws BusinessException 如果参数无效或操作失败则抛出异常
     * @throws Exception
     */
    public function getShareMembers(RequestContext $requestContext, string $resourceId): array
    {
        // 1. 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());
        $userAuthorization = $requestContext->getUserAuthorization();

        // 2. 创建数据隔离对象
        $dataIsolation = DataIsolation::create(
            $userAuthorization->getOrganizationCode(),
            $userAuthorization->getId()
        );
        $requestContext->setDataIsolation($dataIsolation);

        // 3. 委托给Application层处理
        $responseDTO = $this->shareAppService->getShareMembers(
            $userAuthorization,
            $resourceId,
            $dataIsolation
        );

        // 4. 返回DTO转换后的数组格式
        return ['members' => $responseDTO->toArray()];
    }

    /**
     * 获取分享的项目树形结构.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 树形结构数据
     * @throws BusinessException 如果操作失败则抛出异常
     */
    public function getSharedProjectsTree(RequestContext $requestContext): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());
        $userAuthorization = $requestContext->getUserAuthorization();

        // 使用 DTO 处理请求参数
        $dto = GetSharedProjectsTreeRequestDTO::fromRequest($this->request);

        // 调用应用服务层
        return $this->shareAppService->getSharedProjectsTree(
            $userAuthorization,
            $dto->getResourceTypes()
        );
    }

    /**
     * 根据文件ID数组批量获取文件详情.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 文件详情列表
     * @throws BusinessException 如果参数无效或操作失败则抛出异常
     * @throws Exception
     */
    public function getFilesByIds(RequestContext $requestContext): array
    {
        // 1. 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());
        $userAuthorization = $requestContext->getUserAuthorization();

        // 2. 从请求创建并验证DTO
        $dto = GetFilesByIdsRequestDTO::fromRequest($this->request);

        // 3. 调用Application层服务,获取Entity数组
        $fileEntities = $this->shareAppService->getFilesByIds($userAuthorization, $dto);

        // 4. 在Interface层转换Entity为DTO
        $files = [];
        foreach ($fileEntities as $fileEntity) {
            $files[] = TaskFileItemDTO::fromEntity($fileEntity)->toArray();
        }

        // 5. 返回数组格式
        return ['files' => $files];
    }
}

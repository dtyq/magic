<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Provider\Facade\Open;

use App\Application\Provider\Service\AdminProviderAppService;
use App\Application\Provider\Service\ProviderModelAppService;
use App\Domain\Provider\DTO\ProviderModelItemDTO;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Provider\DTO\QueryModelsRequest;
use App\Interfaces\Provider\Facade\AbstractApi;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class ServiceProviderOpenApi extends AbstractApi
{
    #[Inject]
    protected AdminProviderAppService $adminProviderAppService;

    #[Inject]
    protected ProviderModelAppService $providerModelAppService;

    /**
     * 根据分类获取服务商通用逻辑.
     * @param RequestInterface $request 请求对象
     * @return array 服务商列表
     */
    public function getProvidersByCategory(RequestInterface $request): array
    {
        /** @var MagicUserAuthorization $authenticatable */
        $authenticatable = $this->getAuthorization();
        $category = $request->input('category', 'llm');
        $serviceProviderCategory = Category::tryFrom($category);
        if (! $serviceProviderCategory) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidModelType);
        }

        return $this->adminProviderAppService->getOrganizationProvidersModelsByCategory(
            $authenticatable->getOrganizationCode(),
            $serviceProviderCategory
        );
    }

    /**
     * 获取活跃的模型列表（不校验管理员权限）.
     * 返回当前组织下状态为激活的模型，且服务商配置也为激活状态
     * @param RequestInterface $request 请求对象
     * @return ProviderModelItemDTO[] 模型列表
     */
    public function getAvailableModels(RequestInterface $request): array
    {
        /** @var MagicUserAuthorization $authenticatable */
        $authenticatable = $this->getAuthorization();

        // 封装请求参数
        $queryRequest = new QueryModelsRequest($request->all());

        // 验证category参数
        if ($queryRequest->getCategory() === null && $request->input('category') !== null) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidModelType);
        }

        return $this->providerModelAppService->getAvailableOrganizationModels(
            $authenticatable,
            $queryRequest->getCategory(),
            $queryRequest->getModelTypes()
        );
    }

    /**
     * 按分类查询服务商模板列表.
     */
    public function queriesServiceProviderTemplates(RequestInterface $request): array
    {
        /** @var MagicUserAuthorization $authenticatable */
        $authenticatable = $this->getAuthorization();
        $categoryValue = $request->input('category', null);
        $category = $categoryValue ? Category::from($categoryValue) : null;

        return $this->adminProviderAppService->queriesServiceProviderTemplates(
            $category,
            $authenticatable->getOrganizationCode(),
            true,
        );
    }

    /**
     * 根据名称匹配模型（不校验管理员权限）.
     * @param RequestInterface $request 请求对象
     * @return null|array 返回匹配到的模型记录，如果没有匹配到则返回 null
     */
    public function matchModelByName(RequestInterface $request): ?array
    {
        $name = $request->input('name');
        $minScore = (int) $request->input('min_score', 50);
        $limit = (int) $request->input('limit', 10);

        $category = $request->input('category', null);
        return ['models' => $this->adminProviderAppService->matchModelByName($name, $minScore, $limit, $category)];
    }

    /**
     * 查询当前组织下的模型列表（不校验管理员权限）.
     * @param RequestInterface $request 请求对象
     */
    public function queries(RequestInterface $request)
    {
        /** @var MagicUserAuthorization $authenticatable */
        $authenticatable = $this->getAuthorization();

        // 调用AppService获取模型列表
        return $this->providerModelAppService->getCurrentOrganizationModels($authenticatable);
    }
}

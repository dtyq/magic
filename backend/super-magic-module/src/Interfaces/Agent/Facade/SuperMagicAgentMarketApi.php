<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\Facade;

use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\Agent\Service\SuperMagicAgentMarketAppService;
use Dtyq\SuperMagic\Interfaces\Agent\Assembler\SuperMagicAgentAssembler;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\QueryAgentMarketsRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\AbstractApi;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class SuperMagicAgentMarketApi extends AbstractApi
{
    #[Inject]
    protected SuperMagicAgentMarketAppService $superMagicAgentMarketAppService;

    public function __construct(
        protected RequestInterface $request,
    ) {
        parent::__construct($request);
    }

    /**
     * 获取员工市场分类列表.
     */
    public function getCategories(): array
    {
        $authorization = $this->getAuthorization();

        // 调用应用服务层处理业务逻辑
        $result = $this->superMagicAgentMarketAppService->getCategories($authorization);
        $responseDTO = SuperMagicAgentAssembler::createCategoryListItemDTOs($result);

        // 返回响应
        return ['list' => $responseDTO];
    }

    /**
     * 查询员工市场列表.
     */
    public function queries(): array
    {
        $authorization = $this->getAuthorization();

        // 从请求创建DTO
        $requestDTO = QueryAgentMarketsRequestDTO::fromRequest($this->request);

        // 调用应用服务层处理业务逻辑
        $result = $this->superMagicAgentMarketAppService->queries($authorization, $requestDTO);
        $responseDTO = SuperMagicAgentAssembler::createQueryAgentMarketsResponseDTO(
            $result['agent_markets'],
            $result['user_agents_map'],
            $result['latest_versions_map'],
            $result['playbooks_map'],
            $result['page'],
            $result['page_size'],
            $result['total']
        );

        // 返回数组格式
        return $responseDTO->toArray();
    }

    /**
     * 雇用一名市场员工（加入我的员工）.
     */
    public function hireAgent(string $code): array
    {
        $authorization = $this->getAuthorization();

        // 调用应用服务层处理业务逻辑
        $this->superMagicAgentMarketAppService->hireAgent($authorization, $code);

        // 返回空数组
        return [];
    }
}

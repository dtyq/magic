<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\Facade;

use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\Agent\Service\SuperMagicAgentMarketAppService;
use Dtyq\SuperMagic\Interfaces\Agent\Assembler\SuperMagicAgentMarketAssembler;
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
     * Return the available market categories.
     */
    public function getCategories(): array
    {
        $authorization = $this->getAuthorization();

        $result = $this->superMagicAgentMarketAppService->getCategories($authorization);
        $responseDTO = SuperMagicAgentMarketAssembler::createCategoryListItemDTOs($result);

        return ['list' => $responseDTO];
    }

    /**
     * Return the market detail for a published agent.
     */
    public function show(string $code): array
    {
        $authorization = $this->getAuthorization();
        $result = $this->superMagicAgentMarketAppService->show($authorization, $code);

        return SuperMagicAgentMarketAssembler::createAgentMarketDetailResponseDTO(
            $result['agent_market'],
            $result['agent_version']
        )->toArray();
    }

    /**
     * Query the published market list.
     */
    public function queries(): array
    {
        $authorization = $this->getAuthorization();

        $requestDTO = QueryAgentMarketsRequestDTO::fromRequest($this->request);

        $result = $this->superMagicAgentMarketAppService->queries($authorization, $requestDTO);
        $responseDTO = SuperMagicAgentMarketAssembler::createQueryAgentMarketsResponseDTO(
            $result['agent_markets'],
            $result['publisher_user_map'],
            $result['user_agents_map'],
            $result['latest_versions_map'],
            $result['playbooks_map'],
            $result['page'],
            $result['page_size'],
            $result['total']
        );

        return $responseDTO->toArray();
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\Facade;

use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\Skill\Service\SkillMarketAppService;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\Query\SkillQuery;
use Dtyq\SuperMagic\Interfaces\Skill\Assembler\SkillAssembler;
use Dtyq\SuperMagic\Interfaces\Skill\FormRequest\SkillQueryFormRequest;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\AbstractApi;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class SkillMarketApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        protected SkillMarketAppService $skillMarketAppService,
    ) {
        parent::__construct($request);
    }

    /**
     * 获取市场技能库列表.
     *
     * @param RequestContext $requestContext 请求上下文
     */
    public function queries(RequestContext $requestContext, SkillQueryFormRequest $request)
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestData = $request->validated();
        $query = new SkillQuery($requestData);
        $page = $this->createPage();

        $result = $this->skillMarketAppService->queries($requestContext, $query, $page);

        return SkillAssembler::createMarketListResponseDTO(
            $result['list'],
            $result['userSkills'],
            $result['publisherUserMap'],
            $result['creatorSkillCodes'],
            $page->getPage(),
            $page->getPageNum(),
            $result['total'],
            $result['skillVersionMap'] ?? []
        );
    }

    /**
     * 获取市场技能详情.
     */
    public function show(RequestContext $requestContext, string $code)
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $result = $this->skillMarketAppService->show($requestContext, $code);

        return SkillAssembler::createMarketDetailResponseDTO(
            $result['skillMarket'],
            $result['skillVersion'],
            $result['isAdded'],
            $result['isCreator'],
            $result['publisherUser'],
            $result['skillFileUrl']
        );
    }
}

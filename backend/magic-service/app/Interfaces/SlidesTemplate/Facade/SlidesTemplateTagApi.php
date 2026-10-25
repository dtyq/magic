<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SlidesTemplate\Facade;

use App\Application\SlidesTemplate\Service\SlidesTemplateTagAppService;
use App\Application\SuperMagic\Common\Service\AccessTokenAuthorizationService;
use App\Infrastructure\Core\AbstractApi;
use App\Interfaces\SlidesTemplate\Assembler\SlidesTemplateTagAssembler;
use App\Interfaces\SlidesTemplate\DTO\Request\PublicQuerySlidesTemplateTagRequest;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Qbhy\HyperfAuth\Authenticatable;

#[ApiResponse('low_code')]
class SlidesTemplateTagApi extends AbstractApi
{
    public function __construct(
        private readonly SlidesTemplateTagAppService $slidesTemplateTagAppService,
        private readonly AccessTokenAuthorizationService $accessTokenAuthorizationService,
    ) {
    }

    public function queries(PublicQuerySlidesTemplateTagRequest $request): array
    {
        $request->validated();
        $result = $this->slidesTemplateTagAppService->queries($this->getAuthorization(), $request);

        return SlidesTemplateTagAssembler::createPageDTO(
            $result['list'],
            $result['page'],
            $result['total'],
            false
        )->toArray();
    }

    public function groups(PublicQuerySlidesTemplateTagRequest $request): array
    {
        $request->validated();

        return SlidesTemplateTagAssembler::createGroupListDTO(
            $this->slidesTemplateTagAppService->queriesGroups($this->resolveAuthorization($request), $request)
        );
    }

    private function resolveAuthorization(PublicQuerySlidesTemplateTagRequest $request): Authenticatable
    {
        $token = $request->getToken();
        if ($token === '') {
            return $this->getAuthorization();
        }

        return $this->accessTokenAuthorizationService->validateTokenAndCreateUserAuthorization($token);
    }
}

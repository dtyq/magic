<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SlidesTemplate\Facade;

use App\Application\SlidesTemplate\Service\SlidesTemplateCategoryAppService;
use App\Application\SuperMagic\Common\Service\AccessTokenAuthorizationService;
use App\Infrastructure\Core\AbstractApi;
use App\Interfaces\SlidesTemplate\Assembler\SlidesTemplateCategoryAssembler;
use App\Interfaces\SlidesTemplate\DTO\Request\PublicQuerySlidesTemplateCategoryRequest;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Qbhy\HyperfAuth\Authenticatable;

#[ApiResponse('low_code')]
class SlidesTemplateCategoryApi extends AbstractApi
{
    public function __construct(
        private readonly SlidesTemplateCategoryAppService $slidesTemplateCategoryAppService,
        private readonly AccessTokenAuthorizationService $accessTokenAuthorizationService,
    ) {
    }

    public function queries(PublicQuerySlidesTemplateCategoryRequest $request): array
    {
        $request->validated();
        $result = $this->slidesTemplateCategoryAppService->queries(
            $this->resolveAuthorization($request),
            $request
        );

        return SlidesTemplateCategoryAssembler::createPageDTO(
            $result['list'],
            $result['page'],
            $result['total'],
            false
        )->toArray();
    }

    private function resolveAuthorization(PublicQuerySlidesTemplateCategoryRequest $request): Authenticatable
    {
        $token = $request->getToken();
        if ($token === '') {
            return $this->getAuthorization();
        }

        return $this->accessTokenAuthorizationService->validateTokenAndCreateUserAuthorization($token);
    }
}

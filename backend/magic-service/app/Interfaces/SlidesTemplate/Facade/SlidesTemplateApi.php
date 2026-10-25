<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SlidesTemplate\Facade;

use App\Application\SlidesTemplate\Service\SlidesTemplateAppService;
use App\Application\SuperMagic\Common\Service\AccessTokenAuthorizationService;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateQueryScope;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\AbstractApi;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SlidesTemplate\Assembler\SlidesTemplateAssembler;
use App\Interfaces\SlidesTemplate\DTO\Request\PublicQuerySlidesTemplateRequest;
use App\Interfaces\SlidesTemplate\DTO\Request\PublishSlidesTemplateFromProjectRequest;
use App\Interfaces\SlidesTemplate\DTO\Request\QueryFavoriteSlidesTemplateRequest;
use App\Interfaces\SlidesTemplate\DTO\Request\QueryUsedSlidesTemplateRequest;
use App\Interfaces\SlidesTemplate\DTO\Request\SaveUserSlidesTemplateRequest;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Qbhy\HyperfAuth\Authenticatable;

#[ApiResponse('low_code')]
class SlidesTemplateApi extends AbstractApi
{
    public function __construct(
        private readonly SlidesTemplateAppService $slidesTemplateAppService,
        private readonly AccessTokenAuthorizationService $accessTokenAuthorizationService,
    ) {
    }

    public function queries(PublicQuerySlidesTemplateRequest $request): array
    {
        $request->validated();
        $result = $this->slidesTemplateAppService->queries($this->resolveAuthorization($request), $request);

        return SlidesTemplateAssembler::createPublicListPageDTO(
            $result['list'],
            $result['page'],
            $result['favorite_codes'] ?? [],
            $request->getScope() === SlidesTemplateQueryScope::User->value
        )->toArray();
    }

    public function count(PublicQuerySlidesTemplateRequest $request): array
    {
        $request->validated();
        $result = $this->slidesTemplateAppService->count($this->resolveAuthorization($request), $request);

        return SlidesTemplateAssembler::createCountDTO(
            $result['total'],
            $result['total_usage_count'],
            (int) ($result['template_count_today_growth'] ?? 0)
        )->toArray();
    }

    public function detail(string $code): array
    {
        $authorization = $this->getAuthorization();
        $template = $this->slidesTemplateAppService->detail($authorization, $code);
        $currentUserId = $authorization instanceof MagicUserAuthorization ? $authorization->getId() : null;

        return SlidesTemplateAssembler::createPublicDetailDTO($template, $currentUserId)->toArray();
    }

    public function save(SaveUserSlidesTemplateRequest $request): array
    {
        $request->validated();
        return SlidesTemplateAssembler::createSaveUserDTO(
            $this->slidesTemplateAppService->save($this->getAuthorization(), $request)
        )->toArray();
    }

    public function publishFromProject(PublishSlidesTemplateFromProjectRequest $request): array
    {
        $request->validated();
        return SlidesTemplateAssembler::createSaveUserDTO(
            $this->slidesTemplateAppService->publishFromProject($this->getAuthorization(), $request)
        )->toArray();
    }

    public function favorites(QueryFavoriteSlidesTemplateRequest $request): array
    {
        $request->validated();
        $result = $this->slidesTemplateAppService->favorites($this->getAuthorization(), $request);
        return SlidesTemplateAssembler::createPublicListPageDTO($result['list'], $result['page'], $result['favorite_codes'])->toArray();
    }

    public function used(QueryUsedSlidesTemplateRequest $request): array
    {
        $request->validated();
        $result = $this->slidesTemplateAppService->used($this->getAuthorization(), $request);
        return SlidesTemplateAssembler::createUsedListPageDTO(
            $result['list'],
            $result['page'],
            $result['favorite_codes'],
            $result['latest_used_at_by_code']
        )->toArray();
    }

    public function availability(string $code): array
    {
        return SlidesTemplateAssembler::createCodeAvailabilityDTO(
            $this->slidesTemplateAppService->availability($this->getAuthorization(), $code)->value
        )->toArray();
    }

    public function favorite(string $code): array
    {
        $this->slidesTemplateAppService->favorite($this->getAuthorization(), $code);
        return [];
    }

    public function unfavorite(string $code): array
    {
        $this->slidesTemplateAppService->unfavorite($this->getAuthorization(), $code);
        return [];
    }

    public function delete(string $code): array
    {
        $this->slidesTemplateAppService->deleteUserTemplate($this->getAuthorization(), $code);
        return [];
    }

    private function resolveAuthorization(PublicQuerySlidesTemplateRequest $request): Authenticatable
    {
        $token = $request->getToken();
        if ($token === '') {
            return $this->getAuthorization();
        }

        // A share token must never expose the share creator's personal template scope.
        if ($request->getScope() !== SlidesTemplateQueryScope::Official->value) {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied, 'access_denied');
        }

        return $this->accessTokenAuthorizationService->validateTokenAndCreateUserAuthorization($token);
    }
}

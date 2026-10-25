<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Domain\Audit\ModelCall\Entity\ValueObject\AuditStatus;
use App\Domain\ModelGateway\Entity\Dto\SlidesTemplateFileUrlRequestDTO;
use App\Domain\ModelGateway\Entity\Dto\SlidesTemplateTaxonomyRequestDTO;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\SourceId;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateDataIsolation;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateEntity;
use App\Domain\SlidesTemplate\Entity\ValueObject\Query\SlidesTemplateCategoryQuery;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateCategoryStatus;
use App\Domain\SlidesTemplate\Event\SlidesTemplateUsedEvent;
use App\Domain\SlidesTemplate\Service\SlidesTemplateCategoryDomainService;
use App\Domain\SlidesTemplate\Service\SlidesTemplateDomainService;
use App\Domain\SlidesTemplate\Service\SlidesTemplateTagDomainService;
use App\ErrorCode\SlidesTemplateErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\SlidesTemplate\Assembler\SlidesTemplateTaxonomyAssembler;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Hyperf\Di\Annotation\Inject;

use function event_dispatch;

class SlidesTemplateAppService extends AbstractLLMAppService
{
    #[Inject]
    protected SlidesTemplateDomainService $slidesTemplateDomainService;

    #[Inject]
    protected SlidesTemplateCategoryDomainService $slidesTemplateCategoryDomainService;

    #[Inject]
    protected SlidesTemplateTagDomainService $slidesTemplateTagDomainService;

    /**
     * @return array{categories: array<int, array<string, mixed>>, groups: array<int, array<string, mixed>>, tags: array<int, array<string, mixed>>}
     */
    public function getTaxonomy(SlidesTemplateTaxonomyRequestDTO $requestDTO): array
    {
        $modelGatewayDataIsolation = $this->createModelGatewayDataIsolationByAccessToken(
            $requestDTO->getAccessToken(),
            $requestDTO->getBusinessParams()
        );
        $dataIsolation = $this->createSlidesTemplateDataIsolation($modelGatewayDataIsolation);
        $dataIsolation->setContainOfficialOrganization(true);

        $query = new SlidesTemplateCategoryQuery();
        $query->setStatus(SlidesTemplateCategoryStatus::Enabled->value);
        $query->setOnlyWithTemplates(false);
        $categories = $this->slidesTemplateCategoryDomainService->queries(
            $dataIsolation,
            $query,
            Page::createNoPage()
        )['list'] ?? [];

        $groups = $this->slidesTemplateTagDomainService->queriesTree($dataIsolation);

        return SlidesTemplateTaxonomyAssembler::createCatalogDTO($categories, $groups);
    }

    public function getTemplateFileUrl(SlidesTemplateFileUrlRequestDTO $requestDTO, string $code): SlidesTemplateEntity
    {
        $startTime = microtime(true);
        $businessParams = $requestDTO->getBusinessParams();
        $modelGatewayDataIsolation = $this->createModelGatewayDataIsolationByAccessToken($requestDTO->getAccessToken(), $businessParams);
        $dataIsolation = $this->createSlidesTemplateDataIsolation($modelGatewayDataIsolation);
        $dataIsolation->setContainOfficialOrganization(true);

        $this->pointComponent->checkPointsSufficient(
            $requestDTO,
            $modelGatewayDataIsolation
        );

        $template = $this->slidesTemplateDomainService->findEnabledByCodeOrFail($dataIsolation, $code);
        $this->resolveTemplateFileUrl($template);
        $this->slidesTemplateDomainService->incrementActualUsageCount($dataIsolation, $template->getCode());
        $this->dispatchSlidesTemplateUsedEvent(
            $modelGatewayDataIsolation,
            $template,
            $startTime,
            $businessParams,
        );

        return $template;
    }

    protected function resolveTemplateFileUrl(SlidesTemplateEntity $template): void
    {
        $fileLinks = $this->getPrivateFileLinks($template->getOrganizationCode(), [$template->getTemplateFileKey()]);
        $fileLink = $fileLinks[$template->getTemplateFileKey()] ?? null;
        if (! $fileLink instanceof FileLink || trim($fileLink->getUrl()) === '') {
            ExceptionBuilder::throw(SlidesTemplateErrorCode::FILE_URL_GENERATE_FAILED);
        }
        $template->setTemplateFileUrl($fileLink->getUrl());
    }

    protected function dispatchSlidesTemplateUsedEvent(
        ModelGatewayDataIsolation $dataIsolation,
        SlidesTemplateEntity $template,
        float $startTime,
        array $businessParams = [],
    ): void {
        $requestId = trim(CoContext::getRequestId());
        $requestId = $requestId === '' ? IdGenerator::getUniqueId32() : $requestId;
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $userId = $dataIsolation->getCurrentUserId();
        $accessTokenEntity = $dataIsolation->getAccessToken();
        $callTime = (int) round($startTime * 1000);

        event_dispatch(new SlidesTemplateUsedEvent(
            organizationCode: $organizationCode,
            sourceId: SourceId::SLIDES_TEMPLATE_USE,
            callTime: $callTime,
            userId: $userId,
            userName: $dataIsolation->getUserName(),
            requestId: $requestId,
            template: $template,
            businessParams: array_merge($businessParams, [
                'organization_id' => $organizationCode,
                'organization_code' => $organizationCode,
                'user_id' => $userId,
                'user_name' => $dataIsolation->getUserName(),
                'source_id' => SourceId::SLIDES_TEMPLATE_USE,
                'request_id' => $requestId,
                'status' => AuditStatus::SUCCESS->value,
                'operation_time' => $callTime,
                'ak' => $accessTokenEntity->getAccessToken(),
                'access_token_id' => $accessTokenEntity->getId(),
                'access_token_name' => $accessTokenEntity->getName(),
                'access_token_type' => $accessTokenEntity->getType()->value,
                'event_id' => (string) IdGenerator::getSnowId(),
            ]),
        ));
    }

    protected function createSlidesTemplateDataIsolation(ModelGatewayDataIsolation $modelGatewayDataIsolation): SlidesTemplateDataIsolation
    {
        $dataIsolation = new SlidesTemplateDataIsolation();
        $dataIsolation->extends($modelGatewayDataIsolation);
        $dataIsolation->setOfficialOrganizationCodes($modelGatewayDataIsolation->getOfficialOrganizationCodes());
        return $dataIsolation;
    }
}

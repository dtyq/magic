<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SlidesTemplate\Service;

use App\Application\Kernel\AbstractKernelAppService;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateDataIsolation;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateTagEntity;
use App\Domain\SlidesTemplate\Entity\ValueObject\Query\SlidesTemplateTagQuery;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateTagStatus;
use App\Domain\SlidesTemplate\Service\SlidesTemplateTagDomainService;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\SlidesTemplate\DTO\Request\PublicQuerySlidesTemplateTagRequest;
use Qbhy\HyperfAuth\Authenticatable;

class SlidesTemplateTagAppService extends AbstractKernelAppService
{
    public function __construct(
        private readonly SlidesTemplateTagDomainService $slidesTemplateTagDomainService,
    ) {
    }

    /**
     * @return array{page: Page, total: int, list: SlidesTemplateTagEntity[]}
     */
    public function queries(Authenticatable|BaseDataIsolation $authorization, PublicQuerySlidesTemplateTagRequest $request): array
    {
        $dataIsolation = $this->createSlidesTemplateDataIsolation($authorization);
        $dataIsolation->setContainOfficialOrganization(true);

        $query = new SlidesTemplateTagQuery();
        $query->setStatus(SlidesTemplateTagStatus::Enabled->value);
        $query->setNodeType('tag');
        $query->setOnlyWithTemplates(true);
        $query->setTemplateKeyword($request->getKeyword());
        $query->setTemplateCategoryCode($request->getCategoryCode());
        $query->setTemplateTagCodes($request->getTagCodes());
        $query->setTemplateTagMatch($request->getTagMatch());

        $page = new Page($request->getPage(), $request->getPageSize());
        $result = $this->slidesTemplateTagDomainService->queriesWithTemplateCount($dataIsolation, $query, $page);

        return [
            'page' => $page,
            'total' => $result['total'],
            'list' => $result['list'],
        ];
    }

    /**
     * @return SlidesTemplateTagEntity[]
     */
    public function queriesGroups(Authenticatable|BaseDataIsolation $authorization, PublicQuerySlidesTemplateTagRequest $request): array
    {
        $dataIsolation = $this->createSlidesTemplateDataIsolation($authorization);
        $dataIsolation->setContainOfficialOrganization(true);

        return $this->slidesTemplateTagDomainService->queriesCachedVisibleGroupsWithTagsByCategory(
            $dataIsolation,
            $request->getCategoryCode()
        );
    }

    private function createSlidesTemplateDataIsolation(Authenticatable|BaseDataIsolation $authorization): SlidesTemplateDataIsolation
    {
        if ($authorization instanceof SlidesTemplateDataIsolation) {
            return $authorization;
        }

        $dataIsolation = new SlidesTemplateDataIsolation();
        if ($authorization instanceof BaseDataIsolation) {
            $dataIsolation->extends($authorization);
            $dataIsolation->setOfficialOrganizationCodes($authorization->getOfficialOrganizationCodes());
            return $dataIsolation;
        }
        $this->handleByAuthorization($authorization, $dataIsolation);
        return $dataIsolation;
    }
}

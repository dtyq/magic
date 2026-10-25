<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SlidesTemplate\Service;

use App\Application\Kernel\AbstractKernelAppService;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateCategoryEntity;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateDataIsolation;
use App\Domain\SlidesTemplate\Entity\ValueObject\Query\SlidesTemplateCategoryQuery;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateCategoryStatus;
use App\Domain\SlidesTemplate\Service\SlidesTemplateCategoryDomainService;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\SlidesTemplate\DTO\Request\PublicQuerySlidesTemplateCategoryRequest;
use Qbhy\HyperfAuth\Authenticatable;

class SlidesTemplateCategoryAppService extends AbstractKernelAppService
{
    public function __construct(
        private readonly SlidesTemplateCategoryDomainService $slidesTemplateCategoryDomainService,
    ) {
    }

    /**
     * @return array{page: Page, total: int, list: SlidesTemplateCategoryEntity[]}
     */
    public function queries(Authenticatable|BaseDataIsolation $authorization, PublicQuerySlidesTemplateCategoryRequest $request): array
    {
        $dataIsolation = $this->createSlidesTemplateDataIsolation($authorization);
        $dataIsolation->setContainOfficialOrganization(true);

        $query = new SlidesTemplateCategoryQuery();
        $query->setKeyword($request->getKeyword());
        $query->setStatus(SlidesTemplateCategoryStatus::Enabled->value);
        $query->setOnlyWithTemplates(true);

        $page = new Page($request->getPage(), $request->getPageSize());
        $result = $this->slidesTemplateCategoryDomainService->queries($dataIsolation, $query, $page);

        return [
            'page' => $page,
            'total' => $result['total'],
            'list' => $result['list'],
        ];
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

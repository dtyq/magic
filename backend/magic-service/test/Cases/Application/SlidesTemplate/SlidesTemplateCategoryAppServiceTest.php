<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Application\SlidesTemplate;

use App\Application\SlidesTemplate\Service\AdminSlidesTemplateCategoryAppService;
use App\Application\SlidesTemplate\Service\SlidesTemplateCategoryAppService;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateCategoryEntity;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateDataIsolation;
use App\Domain\SlidesTemplate\Entity\ValueObject\Query\SlidesTemplateCategoryQuery;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateCategoryStatus;
use App\Domain\SlidesTemplate\Service\SlidesTemplateCategoryDomainService;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\SlidesTemplate\DTO\Request\AdminQuerySlidesTemplateCategoryRequest;
use App\Interfaces\SlidesTemplate\DTO\Request\PublicQuerySlidesTemplateCategoryRequest;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

/**
 * @internal
 */
class SlidesTemplateCategoryAppServiceTest extends TestCase
{
    public function testAdminQueriesUseTemplateCount(): void
    {
        $dataIsolation = $this->makeDataIsolation('OFFICIAL_ORG', ['OFFICIAL_ORG']);
        $request = new TestAdminQuerySlidesTemplateCategoryRequest(status: 1);
        $category = new SlidesTemplateCategoryEntity();
        $category->setId(123)
            ->setOrganizationCode('OFFICIAL_ORG')
            ->setCode('PPT-CATE-business')
            ->setNameI18n(['zh_CN' => '商务', 'en_US' => 'Business'])
            ->setTemplateCount(3);

        $domainService = $this->createMock(SlidesTemplateCategoryDomainService::class);
        $domainService
            ->expects($this->never())
            ->method('queries');
        $domainService
            ->expects($this->once())
            ->method('queriesWithTemplateCount')
            ->with(
                $this->callback(static fn (SlidesTemplateDataIsolation $actual): bool => $actual->getCurrentOrganizationCode() === 'OFFICIAL_ORG'),
                $this->callback(static fn (SlidesTemplateCategoryQuery $query): bool => $query->getStatus() === SlidesTemplateCategoryStatus::Enabled->value
                    && ! $query->isOnlyWithTemplates()),
                $this->callback(static fn (Page $page): bool => $page->getPage() === 1 && $page->getPageNum() === 20)
            )
            ->willReturn(['total' => 1, 'list' => [$category]]);

        $service = new AdminSlidesTemplateCategoryAppService($domainService);
        $result = $service->queries($dataIsolation, $request);

        $this->assertSame(1, $result['total']);
        $this->assertSame([$category], $result['list']);
        $this->assertInstanceOf(Page::class, $result['page']);
    }

    public function testPublicQueriesUseCurrentAndOfficialEnabledCategoriesWithoutTemplateCount(): void
    {
        $dataIsolation = $this->makeDataIsolation('CURRENT_ORG', ['OFFICIAL_ORG']);
        $request = new TestPublicQuerySlidesTemplateCategoryRequest(keyword: 'business');
        $category = new SlidesTemplateCategoryEntity();
        $category->setId(123)
            ->setOrganizationCode('OFFICIAL_ORG')
            ->setCode('PPT-CATE-business')
            ->setNameI18n(['zh_CN' => '商务', 'en_US' => 'Business'])
            ->setTemplateCount(3);

        $domainService = $this->createMock(SlidesTemplateCategoryDomainService::class);
        $domainService
            ->expects($this->once())
            ->method('queries')
            ->with(
                $this->callback(static fn (SlidesTemplateDataIsolation $actual): bool => $actual->isContainOfficialOrganization()
                    && $actual->getOrganizationCodes() === ['CURRENT_ORG', 'OFFICIAL_ORG']),
                $this->callback(static fn (SlidesTemplateCategoryQuery $query): bool => $query->getKeyword() === 'business'
                    && $query->getStatus() === SlidesTemplateCategoryStatus::Enabled->value
                    && $query->isOnlyWithTemplates()),
                $this->callback(static fn (Page $page): bool => $page->getPage() === 1 && $page->getPageNum() === 200)
            )
            ->willReturn(['total' => 1, 'list' => [$category]]);

        $service = new SlidesTemplateCategoryAppService($domainService);
        $result = $service->queries($dataIsolation, $request);

        $this->assertSame(1, $result['total']);
        $this->assertSame([$category], $result['list']);
        $this->assertInstanceOf(Page::class, $result['page']);
    }

    private function makeDataIsolation(string $organizationCode, array $officialOrganizationCodes): SlidesTemplateDataIsolation
    {
        /** @var SlidesTemplateDataIsolation $dataIsolation */
        $dataIsolation = (new ReflectionClass(SlidesTemplateDataIsolation::class))->newInstanceWithoutConstructor();
        $dataIsolation->setCurrentOrganizationCode($organizationCode);
        $dataIsolation->setCurrentUserId('user-1');
        $dataIsolation->setMagicId('magic-1');
        $dataIsolation->setEnabled(true);
        $dataIsolation->setContainOfficialOrganization(false);
        $dataIsolation->setOnlyOfficialOrganization(false);
        $dataIsolation->setOfficialOrganizationCodes($officialOrganizationCodes);
        return $dataIsolation;
    }
}

class TestAdminQuerySlidesTemplateCategoryRequest extends AdminQuerySlidesTemplateCategoryRequest
{
    public function __construct(
        private readonly ?string $keyword = null,
        private readonly ?string $code = null,
        private readonly ?int $status = null,
        private readonly int $page = 1,
        private readonly int $pageSize = 20,
    ) {
    }

    public function getKeyword(): ?string
    {
        return $this->keyword;
    }

    public function getCode(): ?string
    {
        return $this->code;
    }

    public function getStatus(): ?int
    {
        return $this->status;
    }

    public function getPage(): int
    {
        return $this->page;
    }

    public function getPageSize(): int
    {
        return $this->pageSize;
    }
}

class TestPublicQuerySlidesTemplateCategoryRequest extends PublicQuerySlidesTemplateCategoryRequest
{
    public function __construct(
        private readonly ?string $keyword = null,
        private readonly int $page = 1,
        private readonly int $pageSize = 200,
    ) {
    }

    public function getKeyword(): ?string
    {
        return $this->keyword;
    }

    public function getPage(): int
    {
        return $this->page;
    }

    public function getPageSize(): int
    {
        return $this->pageSize;
    }
}

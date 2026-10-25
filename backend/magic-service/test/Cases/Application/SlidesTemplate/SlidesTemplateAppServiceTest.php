<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Application\SlidesTemplate;

use App\Application\ModelGateway\Component\Points\PointComponentInterface;
use App\Application\ModelGateway\Service\SlidesTemplateAppService as ModelGatewaySlidesTemplateAppService;
use App\Application\SlidesTemplate\Service\AdminSlidesTemplateAppService;
use App\Application\SlidesTemplate\Service\SlidesTemplateAppService as PublicSlidesTemplateAppService;
use App\Application\SlidesTemplate\Service\SlidesTemplateProjectExportService;
use App\Domain\Audit\ResourceAccess\Service\ResourceAccessLogDomainService;
use App\Domain\ModelGateway\Entity\Dto\SlidesTemplateFileUrlRequestDTO;
use App\Domain\ModelGateway\Entity\Dto\SlidesTemplateTaxonomyRequestDTO;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\SourceId;
use App\Domain\OrganizationEnvironment\DTO\MagicOrganizationEnvDTO;
use App\Domain\OrganizationEnvironment\Entity\MagicEnvironmentEntity;
use App\Domain\OrganizationEnvironment\Service\MagicOrganizationEnvDomainService;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateCategoryEntity;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateDataIsolation;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateEntity;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateTagEntity;
use App\Domain\SlidesTemplate\Entity\ValueObject\Query\SlidesTemplateCategoryQuery;
use App\Domain\SlidesTemplate\Entity\ValueObject\Query\SlidesTemplateQuery;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateQueryScope;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateSourceType;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateStatus;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateTagMatch;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateTagStatus;
use App\Domain\SlidesTemplate\Event\SlidesTemplateUsedEvent;
use App\Domain\SlidesTemplate\Service\SlidesTemplateCategoryDomainService;
use App\Domain\SlidesTemplate\Service\SlidesTemplateColorExtractor;
use App\Domain\SlidesTemplate\Service\SlidesTemplateDomainService;
use App\Domain\SlidesTemplate\Service\SlidesTemplateFavoriteDomainService;
use App\Domain\SlidesTemplate\Service\SlidesTemplateTagDomainService;
use App\Domain\SlidesTemplate\Service\SlidesTemplateVectorIndexDomainService;
use App\ErrorCode\SlidesTemplateErrorCode;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\DataIsolation\BaseHandleDataIsolation;
use App\Infrastructure\Core\DataIsolation\BaseOrganizationInfoManager;
use App\Infrastructure\Core\DataIsolation\BaseSubscriptionManager;
use App\Infrastructure\Core\DataIsolation\BaseThirdPlatformDataIsolationManager;
use App\Infrastructure\Core\DataIsolation\HandleDataIsolationInterface;
use App\Infrastructure\Core\DataIsolation\OrganizationInfoManagerInterface;
use App\Infrastructure\Core\DataIsolation\SubscriptionManagerInterface;
use App\Infrastructure\Core\DataIsolation\ThirdPlatformDataIsolationManagerInterface;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SlidesTemplate\DTO\Request\AdminQuerySlidesTemplateRequest;
use App\Interfaces\SlidesTemplate\DTO\Request\PublicQuerySlidesTemplateRequest;
use App\Interfaces\SlidesTemplate\DTO\Request\SaveSlidesTemplateRequest;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\EventDispatcher\EventDispatcherInterface;
use Qbhy\HyperfAuth\Authenticatable;
use ReflectionClass;
use RuntimeException;

/**
 * @internal
 */
class SlidesTemplateAppServiceTest extends TestCase
{
    private static bool $hadOriginalContainer = false;

    private static ?ContainerInterface $originalContainer = null;

    public static function setUpBeforeClass(): void
    {
        self::$hadOriginalContainer = ApplicationContext::hasContainer();
        self::$originalContainer = self::$hadOriginalContainer ? ApplicationContext::getContainer() : null;

        ApplicationContext::setContainer(new class implements ContainerInterface {
            public function make(string $name, array $parameters = []): mixed
            {
                return $this->get($name);
            }

            public function get(string $id)
            {
                return match ($id) {
                    ConfigInterface::class => new class implements ConfigInterface {
                        public function get(string $key, mixed $default = null): mixed
                        {
                            return match ($key) {
                                'app_env' => 'test',
                                'service_provider.office_organization' => 'OFFICIAL_ORG',
                                'error_message' => [
                                    'exception_class' => BusinessException::class,
                                    'error_code_mapper' => [
                                        SlidesTemplateErrorCode::class => [47000, 47999],
                                    ],
                                ],
                                default => $default,
                            };
                        }

                        public function has(string $keys): bool
                        {
                            return $keys === 'error_message';
                        }

                        public function set(string $key, mixed $value): void
                        {
                        }
                    },
                    ThirdPlatformDataIsolationManagerInterface::class => new BaseThirdPlatformDataIsolationManager(),
                    SubscriptionManagerInterface::class => new BaseSubscriptionManager(),
                    OrganizationInfoManagerInterface::class => new BaseOrganizationInfoManager(),
                    HandleDataIsolationInterface::class => new BaseHandleDataIsolation(),
                    EventDispatcherInterface::class => new class implements EventDispatcherInterface {
                        public function dispatch(object $event): object
                        {
                            return $event;
                        }
                    },
                    MagicOrganizationEnvDomainService::class => new class extends MagicOrganizationEnvDomainService {
                        public function __construct()
                        {
                        }

                        public function getOrganizationsEnvironmentDTO(string $magicOrganizationCode): ?MagicOrganizationEnvDTO
                        {
                            return null;
                        }

                        public function getMagicEnvironmentById(int $envId): ?MagicEnvironmentEntity
                        {
                            return null;
                        }
                    },
                    TranslatorInterface::class => new class implements TranslatorInterface {
                        public function trans(string $key, array $replace = [], ?string $locale = null): string
                        {
                            return $key;
                        }

                        public function transChoice(string $key, $number, array $replace = [], ?string $locale = null): string
                        {
                            return $key;
                        }

                        public function getLocale(): string
                        {
                            return 'zh_CN';
                        }

                        public function setLocale(string $locale)
                        {
                            return $this;
                        }
                    },
                    default => throw new RuntimeException('Unexpected container dependency: ' . $id),
                };
            }

            public function has(string $id): bool
            {
                return in_array($id, [
                    ConfigInterface::class,
                    TranslatorInterface::class,
                    ThirdPlatformDataIsolationManagerInterface::class,
                    SubscriptionManagerInterface::class,
                    OrganizationInfoManagerInterface::class,
                    HandleDataIsolationInterface::class,
                    EventDispatcherInterface::class,
                    MagicOrganizationEnvDomainService::class,
                ], true);
            }
        });
    }

    public static function tearDownAfterClass(): void
    {
        $property = (new ReflectionClass(ApplicationContext::class))->getProperty('container');
        $property->setAccessible(true);
        $property->setValue(null, self::$hadOriginalContainer ? self::$originalContainer : null);

        self::$hadOriginalContainer = false;
        self::$originalContainer = null;
    }

    public function testQueriesUseCurrentAndOfficialEnabledTemplates(): void
    {
        $dataIsolation = $this->makeDataIsolation('CURRENT_ORG', ['OFFICIAL_ORG']);
        $request = new TestPublicQuerySlidesTemplateRequest(categoryCode: 'PPT-CATE-business');

        $domainService = $this->createMock(SlidesTemplateDomainService::class);
        $domainService
            ->expects($this->once())
            ->method('queries')
            ->with(
                $this->callback(static fn (SlidesTemplateDataIsolation $actual): bool => $actual->isContainOfficialOrganization()
                    && $actual->getOrganizationCodes() === ['CURRENT_ORG', 'OFFICIAL_ORG']),
                $this->callback(static fn (SlidesTemplateQuery $query): bool => $query->getStatus() === SlidesTemplateStatus::Enabled->value
                    && $query->getCategoryCode() === 'PPT-CATE-business'),
                $this->callback(static fn (Page $page): bool => $page->getPage() === 1 && $page->getPageNum() === 20 && ! $page->isTotal())
            )
            ->willReturn(['total' => -1, 'list' => []]);
        $domainService->method('queriesFavorites')->willReturn(['total' => 0, 'list' => []]);

        $service = new TestableSlidesTemplateAppService($domainService);
        $result = $service->queries($dataIsolation, $request);

        $this->assertArrayNotHasKey('total', $result);
        $this->assertSame([], $result['list']);
        $this->assertInstanceOf(Page::class, $result['page']);
        $this->assertSame(1, $result['page']->getPage());
        $this->assertSame(20, $result['page']->getPageNum());
        $this->assertSame([], $service->fileLinkCalls);
    }

    public function testGetTemplateFileUrlUsesTemplateOrganizationCode(): void
    {
        $authorization = $this->makeAuthorization('CURRENT_ORG', 'user-1', 'user-1');
        $template = new SlidesTemplateEntity();
        $template->setOrganizationCode('OFFICIAL_ORG')
            ->setCode('PPT-65f2c8a42d7b0-123456')
            ->setLabel(['zh_CN' => '职场白皮书', 'en_US' => 'Corporate Whitepaper'])
            ->setTemplateFileKey('slides/templates/business.zip')
            ->setThumbnailFileKey('slides/thumbnails/business.png');

        $domainService = $this->createMock(SlidesTemplateDomainService::class);
        $domainService
            ->expects($this->once())
            ->method('findEnabledByCodeOrFail')
            ->with(
                $this->callback(static fn (SlidesTemplateDataIsolation $actual): bool => $actual->isContainOfficialOrganization()
                    && $actual->getOrganizationCodes() === ['CURRENT_ORG', 'OFFICIAL_ORG']),
                'PPT-65f2c8a42d7b0-123456'
            )
            ->willReturn($template);
        $domainService
            ->expects($this->once())
            ->method('incrementActualUsageCount')
            ->with(
                $this->callback(static fn (SlidesTemplateDataIsolation $actual): bool => $actual->isContainOfficialOrganization()
                    && $actual->getOrganizationCodes() === ['CURRENT_ORG', 'OFFICIAL_ORG']),
                'PPT-65f2c8a42d7b0-123456'
            );

        $service = new TestableModelGatewaySlidesTemplateAppService(
            $domainService,
            $this->createMock(PointComponentInterface::class),
        );
        $result = $service->getTemplateFileUrl($this->makeFileUrlRequest(), 'PPT-65f2c8a42d7b0-123456');

        $this->assertSame($template, $result);
        $this->assertSame('https://signed.example/OFFICIAL_ORG/slides/templates/business.zip', $result->getTemplateFileUrl());
        $this->assertSame([
            ['OFFICIAL_ORG', ['slides/templates/business.zip']],
        ], $service->fileLinkCalls);
    }

    public function testGetTaxonomyReturnsEnabledOfficialCatalogWithoutTemplateFilter(): void
    {
        $category = new SlidesTemplateCategoryEntity();
        $category->setCode('PPT-CATE-education-training')
            ->setNameI18n(['zh_CN' => '教育培训', 'en_US' => 'Education & Training'])
            ->setStatus(1)
            ->setSort(8);

        $purposeGroup = (new SlidesTemplateTagEntity())
            ->setId(1)
            ->setParentId(0)
            ->setNodeType('group')
            ->setCode('purpose_group')
            ->setNameI18n(['zh_CN' => '用途', 'en_US' => 'Purpose'])
            ->setStatus(SlidesTemplateTagStatus::Enabled)
            ->setSort(10);
        $enabledTag = (new SlidesTemplateTagEntity())
            ->setId(2)
            ->setParentId(1)
            ->setNodeType('tag')
            ->setCode('purpose-training-course')
            ->setNameI18n(['zh_CN' => '培训课程', 'en_US' => 'Training Course'])
            ->setStatus(SlidesTemplateTagStatus::Enabled)
            ->setSort(9);
        $disabledTag = (new SlidesTemplateTagEntity())
            ->setId(3)
            ->setParentId(1)
            ->setNodeType('tag')
            ->setCode('purpose-disabled')
            ->setNameI18n(['zh_CN' => '停用', 'en_US' => 'Disabled'])
            ->setStatus(SlidesTemplateTagStatus::Disabled)
            ->setSort(1);
        $purposeGroup->setChildren([$enabledTag, $disabledTag]);

        $disabledGroup = (new SlidesTemplateTagEntity())
            ->setId(4)
            ->setParentId(0)
            ->setNodeType('group')
            ->setCode('legacy_group')
            ->setNameI18n(['zh_CN' => '停用组', 'en_US' => 'Legacy'])
            ->setStatus(SlidesTemplateTagStatus::Disabled)
            ->setSort(1);
        $orphanTag = (new SlidesTemplateTagEntity())
            ->setId(5)
            ->setParentId(4)
            ->setNodeType('tag')
            ->setCode('legacy-tag')
            ->setNameI18n(['zh_CN' => '遗留', 'en_US' => 'Legacy'])
            ->setStatus(SlidesTemplateTagStatus::Enabled);
        $disabledGroup->setChildren([$orphanTag]);

        $emptyGroup = (new SlidesTemplateTagEntity())
            ->setId(6)
            ->setParentId(0)
            ->setNodeType('group')
            ->setCode('empty_group')
            ->setNameI18n(['zh_CN' => '空组', 'en_US' => 'Empty'])
            ->setStatus(SlidesTemplateTagStatus::Enabled)
            ->setChildren([]);

        $categoryDomainService = $this->createMock(SlidesTemplateCategoryDomainService::class);
        $categoryDomainService
            ->expects($this->once())
            ->method('queries')
            ->with(
                $this->callback(static fn (SlidesTemplateDataIsolation $actual): bool => $actual->isContainOfficialOrganization()
                    && $actual->getOrganizationCodes() === ['CURRENT_ORG', 'OFFICIAL_ORG']),
                $this->callback(static fn (SlidesTemplateCategoryQuery $query): bool => $query->getStatus() === 1
                    && ! $query->isOnlyWithTemplates()),
                $this->callback(static fn (Page $page): bool => ! $page->isEnabled())
            )
            ->willReturn(['total' => 1, 'list' => [$category]]);

        $tagDomainService = $this->createMock(SlidesTemplateTagDomainService::class);
        $tagDomainService
            ->expects($this->once())
            ->method('queriesTree')
            ->with($this->callback(static fn (SlidesTemplateDataIsolation $actual): bool => $actual->isContainOfficialOrganization()))
            ->willReturn([$purposeGroup, $disabledGroup, $emptyGroup]);

        $pointComponent = $this->createMock(PointComponentInterface::class);
        $pointComponent->expects($this->never())->method('checkPointsSufficient');

        $service = new TestableModelGatewaySlidesTemplateAppService(
            $this->createMock(SlidesTemplateDomainService::class),
            $pointComponent,
            $categoryDomainService,
            $tagDomainService,
        );
        $result = $service->getTaxonomy($this->makeTaxonomyRequest());

        $this->assertSame([
            'categories' => [[
                'code' => 'PPT-CATE-education-training',
                'name_i18n' => ['zh_CN' => '教育培训', 'en_US' => 'Education & Training'],
                'sort' => 8,
                'status' => 1,
            ]],
            'groups' => [[
                'code' => 'purpose_group',
                'name_i18n' => ['zh_CN' => '用途', 'en_US' => 'Purpose'],
                'sort' => 10,
            ]],
            'tags' => [[
                'code' => 'purpose-training-course',
                'group_code' => 'purpose_group',
                'name_i18n' => ['zh_CN' => '培训课程', 'en_US' => 'Training Course'],
                'sort' => 9,
                'status' => 1,
            ]],
        ], $result);
    }

    public function testQueriesResolveOnlyThumbnailFromPublicBucket(): void
    {
        $dataIsolation = $this->makeDataIsolation('CURRENT_ORG', ['OFFICIAL_ORG']);
        $request = new TestPublicQuerySlidesTemplateRequest();

        $template = new SlidesTemplateEntity();
        $template->setOrganizationCode('OFFICIAL_ORG')
            ->setCode('PPT-65f2c8a42d7b0-123456')
            ->setThumbnailFileKey('slides/thumbnails/business.png')
            ->setCollageFileKey('slides/collages/business.png')
            ->setPreviewImageFileKeys([
                'slides/previews/business-1.png',
                'slides/previews/business-2.png',
            ])
            ->setTemplateFileKey('slides/templates/business.zip');

        $domainService = $this->createMock(SlidesTemplateDomainService::class);
        $domainService
            ->expects($this->once())
            ->method('queries')
            ->willReturn(['total' => 1, 'list' => [$template]]);
        $domainService->method('queriesFavorites')->willReturn(['total' => 0, 'list' => []]);

        $service = new TestableSlidesTemplateAppService($domainService);
        $result = $service->queries($dataIsolation, $request);

        $this->assertSame([$template], $result['list']);
        $this->assertSame('https://public.example/OFFICIAL_ORG/slides/thumbnails/business.png', $template->getThumbnailUrl());
        $this->assertSame('https://public.example/OFFICIAL_ORG/slides/collages/business.png', $template->getCollageUrl());
        $this->assertSame([], $template->getPreviewImageUrls());
        $this->assertSame([
            ['OFFICIAL_ORG', [
                'slides/thumbnails/business.png',
                'slides/collages/business.png',
            ]],
        ], $service->publicFileLinkCalls);
        $this->assertSame([], $service->fileLinkCalls);
    }

    public function testCountUsesSamePublicQueryFilters(): void
    {
        $dataIsolation = $this->makeDataIsolation('CURRENT_ORG', ['OFFICIAL_ORG']);
        $request = new TestPublicQuerySlidesTemplateRequest(categoryCode: 'PPT-CATE-business', keyword: 'report');

        $domainService = $this->createMock(SlidesTemplateDomainService::class);
        $domainService
            ->expects($this->once())
            ->method('getCount')
            ->with(
                $this->callback(static fn (SlidesTemplateDataIsolation $actual): bool => $actual->isContainOfficialOrganization()
                    && $actual->getOrganizationCodes() === ['CURRENT_ORG', 'OFFICIAL_ORG']),
                $this->callback(static fn (SlidesTemplateQuery $query): bool => $query->getStatus() === SlidesTemplateStatus::Enabled->value
                    && $query->getCategoryCode() === 'PPT-CATE-business'
                    && $query->getKeyword() === 'report')
            )
            ->willReturn(['total' => 1780, 'total_usage_count' => 245]);
        $domainService->method('queriesFavorites')->willReturn(['total' => 0, 'list' => []]);

        $service = new TestableSlidesTemplateAppService($domainService);

        $this->assertSame(['total' => 1780, 'total_usage_count' => 245], $service->count($dataIsolation, $request));
    }

    public function testDetailResolvesPublicAssetsWithoutPrivateTemplateFileUrl(): void
    {
        $dataIsolation = $this->makeDataIsolation('CURRENT_ORG', ['OFFICIAL_ORG']);
        $template = new SlidesTemplateEntity();
        $template->setOrganizationCode('OFFICIAL_ORG')
            ->setId(123)
            ->setCode('PPT-65f2c8a42d7b0-123456')
            ->setThumbnailFileKey('slides/thumbnails/business.png')
            ->setCollageFileKey('slides/collages/business.png')
            ->setPreviewImageFileKeys([
                'slides/previews/business-1.png',
                'slides/previews/business-2.png',
            ])
            ->setTemplateFileKey('slides/templates/business.zip');

        $domainService = $this->createMock(SlidesTemplateDomainService::class);
        $domainService
            ->expects($this->once())
            ->method('findByCodeOrFail')
            ->with(
                $this->callback(static fn (SlidesTemplateDataIsolation $actual): bool => $actual->isContainOfficialOrganization()
                    && $actual->getOrganizationCodes() === ['CURRENT_ORG', 'OFFICIAL_ORG']),
                'PPT-65f2c8a42d7b0-123456'
            )
            ->willReturn($template);
        $domainService->expects($this->once())
            ->method('assertUserAccessible')
            ->with($dataIsolation, $template);

        $service = new TestableSlidesTemplateAppService($domainService);
        $result = $service->detail($dataIsolation, 'PPT-65f2c8a42d7b0-123456');

        $this->assertSame(123, $result->getId());
        $this->assertSame('PPT-65f2c8a42d7b0-123456', $result->getCode());
        $this->assertSame('OFFICIAL_ORG', $result->getOrganizationCode());
        $this->assertSame('https://public.example/OFFICIAL_ORG/slides/thumbnails/business.png', $result->getThumbnailUrl());
        $this->assertSame('https://public.example/OFFICIAL_ORG/slides/collages/business.png', $result->getCollageUrl());
        $this->assertSame([
            'https://public.example/OFFICIAL_ORG/slides/previews/business-1.png',
            'https://public.example/OFFICIAL_ORG/slides/previews/business-2.png',
        ], $result->getPreviewImageUrls());
        $this->assertNull($result->getTemplateFileUrl());
        $this->assertSame([
            ['OFFICIAL_ORG', [
                'slides/thumbnails/business.png',
                'slides/collages/business.png',
                'slides/previews/business-1.png',
                'slides/previews/business-2.png',
            ]],
        ], $service->publicFileLinkCalls);
        $this->assertSame([], $service->fileLinkCalls);
    }

    public function testGetTemplateFileUrlDispatchesTemplateUsedEventAfterUrlResolved(): void
    {
        $authorization = $this->makeAuthorization('CURRENT_ORG', 'user-1', 'user-1');
        $template = new SlidesTemplateEntity();
        $template->setOrganizationCode('OFFICIAL_ORG')
            ->setCode('PPT-65f2c8a42d7b0-123456')
            ->setLabel(['zh_CN' => '职场白皮书', 'en_US' => 'Corporate Whitepaper'])
            ->setTemplateFileKey('slides/templates/business.zip')
            ->setThumbnailFileKey('slides/thumbnails/business.png');

        $domainService = $this->createMock(SlidesTemplateDomainService::class);
        $domainService
            ->expects($this->once())
            ->method('findEnabledByCodeOrFail')
            ->willReturn($template);

        $service = new TestableModelGatewaySlidesTemplateAppService(
            $domainService,
            $this->createMock(PointComponentInterface::class),
        );
        $result = $service->getTemplateFileUrl($this->makeFileUrlRequest(), 'PPT-65f2c8a42d7b0-123456');

        $this->assertSame($template, $result);
        $this->assertCount(1, $service->dispatchedEvents);
        $event = $service->dispatchedEvents[0];
        $this->assertInstanceOf(SlidesTemplateUsedEvent::class, $event);
        $this->assertSame($template, $event->getTemplate());
        $this->assertSame('CURRENT_ORG', $event->getOrganizationCode());
        $this->assertSame(SourceId::SLIDES_TEMPLATE_USE, $event->getSourceId());
        $this->assertSame('user-1', $event->getUserId());
        $this->assertSame('user-1', $event->getUserName());
        $this->assertNotSame('', $event->getRequestId());
        $this->assertGreaterThan(0, $event->getCallTime());
    }

    public function testGetTemplateFileUrlDispatchesTemplateUsedEventWithSourceUsername(): void
    {
        $authorization = $this->makeAuthorization('CURRENT_ORG', 'user-1', '张三');

        $template = new SlidesTemplateEntity();
        $template->setOrganizationCode('OFFICIAL_ORG')
            ->setCode('PPT-65f2c8a42d7b0-123456')
            ->setLabel(['zh_CN' => '职场白皮书'])
            ->setTemplateFileKey('slides/templates/business.zip');

        $domainService = $this->createMock(SlidesTemplateDomainService::class);
        $domainService
            ->expects($this->once())
            ->method('findEnabledByCodeOrFail')
            ->willReturn($template);

        $service = new TestableModelGatewaySlidesTemplateAppService(
            $domainService,
            $this->createMock(PointComponentInterface::class),
        );
        $service->getTemplateFileUrl($this->makeFileUrlRequest('张三'), 'PPT-65f2c8a42d7b0-123456');

        $this->assertCount(1, $service->dispatchedEvents);
        $event = $service->dispatchedEvents[0];
        $this->assertInstanceOf(SlidesTemplateUsedEvent::class, $event);
        $this->assertSame('user-1', $event->getUserId());
        $this->assertSame('张三', $event->getUserName());
    }

    public function testGetTemplateFileUrlDispatchesTemplateUsedEventWithDefaultSourceId(): void
    {
        $template = new SlidesTemplateEntity();
        $template->setOrganizationCode('OFFICIAL_ORG')
            ->setCode('PPT-65f2c8a42d7b0-123456')
            ->setLabel(['zh_CN' => '职场白皮书'])
            ->setTemplateFileKey('slides/templates/business.zip');

        $domainService = $this->createMock(SlidesTemplateDomainService::class);
        $domainService
            ->expects($this->once())
            ->method('findEnabledByCodeOrFail')
            ->willReturn($template);

        $service = new TestableModelGatewaySlidesTemplateAppService(
            $domainService,
            $this->createMock(PointComponentInterface::class),
        );
        $service->getTemplateFileUrl($this->makeFileUrlRequest(), 'PPT-65f2c8a42d7b0-123456');

        $this->assertCount(1, $service->dispatchedEvents);
        $event = $service->dispatchedEvents[0];
        $this->assertInstanceOf(SlidesTemplateUsedEvent::class, $event);
        $this->assertSame(SourceId::SLIDES_TEMPLATE_USE, $event->getSourceId());
    }

    public function testAdminDeleteRejectsNonOfficialOrganization(): void
    {
        $dataIsolation = $this->makeDataIsolation('CURRENT_ORG', ['OFFICIAL_ORG']);

        $domainService = $this->createMock(SlidesTemplateDomainService::class);
        $domainService->expects($this->never())->method('delete');

        $service = $this->makeAdminSlidesTemplateAppService($domainService);

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(SlidesTemplateErrorCode::ONLY_OFFICIAL_ORGANIZATION_CAN_MANAGE->value);

        $service->delete($dataIsolation, 123);
    }

    public function testAdminCreateGeneratesCodeBeforeSaving(): void
    {
        $dataIsolation = $this->makeDataIsolation('OFFICIAL_ORG', ['OFFICIAL_ORG']);
        $request = $this->createMock(SaveSlidesTemplateRequest::class);
        $request->method('getLabel')->willReturn([
            'zh_CN' => '职场白皮书',
            'en_US' => 'Corporate Whitepaper',
        ]);
        $request->method('getDescription')->willReturn([
            'zh_CN' => '适用于企业汇报。',
            'en_US' => 'For business reviews.',
        ]);
        $request->method('getThumbnailFileKey')->willReturn('');
        $request->method('getCollageFileKey')->willReturn(null);
        $request->method('getTemplateFileKey')->willReturn('slides/templates/business.zip');
        $request->method('getPreviewUrl')->willReturn(null);
        $request->method('getStatus')->willReturn(SlidesTemplateStatus::Enabled->value);
        $request->method('getSort')->willReturn(100);

        $capturedTemplate = null;
        $domainService = $this->createMock(SlidesTemplateDomainService::class);
        $domainService
            ->expects($this->once())
            ->method('create')
            ->with(
                $this->callback(static fn (SlidesTemplateDataIsolation $actual): bool => $actual->getCurrentOrganizationCode() === 'OFFICIAL_ORG'),
                $this->isInstanceOf(SlidesTemplateEntity::class)
            )
            ->willReturnCallback(static function (SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateEntity $entity) use (&$capturedTemplate): SlidesTemplateEntity {
                $capturedTemplate = $entity;
                return $entity->setId(123);
            });

        $service = $this->makeAdminSlidesTemplateAppService($domainService);
        $result = $service->create($dataIsolation, $request);

        $this->assertSame($capturedTemplate, $result);
        $this->assertMatchesRegularExpression('/^SLIDE-[0-9a-f]+-[0-9]+$/', $result->getCode());
        $this->assertSame('OFFICIAL_ORG', $result->getOrganizationCode());
        $this->assertSame('user-1', $result->getCreatedUid());
        $this->assertSame('user-1', $result->getUpdatedUid());
        $this->assertSame(100, $result->getSort());
        $this->assertSame(0, $result->getBaseUsageCount());
        $this->assertSame(0, $result->getActualUsageCount());
        $this->assertSame(SlidesTemplateSourceType::Custom, $result->getSourceType());
    }

    public function testAdminCreateUsesCustomCodeBeforeSaving(): void
    {
        $dataIsolation = $this->makeDataIsolation('OFFICIAL_ORG', ['OFFICIAL_ORG']);
        $request = $this->createMock(SaveSlidesTemplateRequest::class);
        $request->method('getCode')->willReturn('PPT-business-minimal');
        $request->method('getLabel')->willReturn([
            'zh_CN' => '职场白皮书',
            'en_US' => 'Corporate Whitepaper',
        ]);
        $request->method('getDescription')->willReturn([
            'zh_CN' => '适用于企业汇报。',
            'en_US' => 'For business reviews.',
        ]);
        $request->method('getThumbnailFileKey')->willReturn('');
        $request->method('getCollageFileKey')->willReturn(null);
        $request->method('getTemplateFileKey')->willReturn('slides/templates/business.zip');
        $request->method('getPreviewUrl')->willReturn(null);
        $request->method('getStatus')->willReturn(SlidesTemplateStatus::Enabled->value);
        $request->method('getSort')->willReturn(100);

        $domainService = $this->createMock(SlidesTemplateDomainService::class);
        $domainService
            ->expects($this->once())
            ->method('create')
            ->with(
                $this->callback(static fn (SlidesTemplateDataIsolation $actual): bool => $actual->getCurrentOrganizationCode() === 'OFFICIAL_ORG'),
                $this->callback(static fn (SlidesTemplateEntity $entity): bool => $entity->getCode() === 'PPT-business-minimal')
            )
            ->willReturnCallback(static fn (SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateEntity $entity): SlidesTemplateEntity => $entity->setId(123));

        $service = $this->makeAdminSlidesTemplateAppService($domainService);
        $result = $service->create($dataIsolation, $request);

        $this->assertSame('PPT-business-minimal', $result->getCode());
        $this->assertSame(SlidesTemplateSourceType::Custom, $result->getSourceType());
    }

    public function testAdminCreateStoresCategoryCodeAfterValidatingCategory(): void
    {
        $dataIsolation = $this->makeDataIsolation('OFFICIAL_ORG', ['OFFICIAL_ORG']);
        $request = $this->createMock(SaveSlidesTemplateRequest::class);
        $request->method('getCategoryCode')->willReturn('PPT-CATE-business');
        $request->method('getLabel')->willReturn([
            'zh_CN' => '职场白皮书',
            'en_US' => 'Corporate Whitepaper',
        ]);
        $request->method('getDescription')->willReturn([
            'zh_CN' => '适用于企业汇报。',
            'en_US' => 'For business reviews.',
        ]);
        $request->method('getThumbnailFileKey')->willReturn('');
        $request->method('getCollageFileKey')->willReturn(null);
        $request->method('getTemplateFileKey')->willReturn('slides/templates/business.zip');
        $request->method('getPreviewUrl')->willReturn(null);
        $request->method('getStatus')->willReturn(SlidesTemplateStatus::Enabled->value);
        $request->method('getSort')->willReturn(100);

        $category = new SlidesTemplateCategoryEntity();
        $category->setCode('PPT-CATE-business');

        $categoryDomainService = $this->createMock(SlidesTemplateCategoryDomainService::class);
        $categoryDomainService
            ->expects($this->once())
            ->method('findByCodeOrFail')
            ->with(
                $this->callback(static fn (SlidesTemplateDataIsolation $actual): bool => $actual->getCurrentOrganizationCode() === 'OFFICIAL_ORG'),
                'PPT-CATE-business'
            )
            ->willReturn($category);

        $domainService = $this->createMock(SlidesTemplateDomainService::class);
        $domainService
            ->expects($this->once())
            ->method('create')
            ->with(
                $this->isInstanceOf(SlidesTemplateDataIsolation::class),
                $this->callback(static fn (SlidesTemplateEntity $entity): bool => $entity->getCategoryCode() === 'PPT-CATE-business')
            )
            ->willReturnCallback(static fn (SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateEntity $entity): SlidesTemplateEntity => $entity->setId(123));

        $service = $this->makeAdminSlidesTemplateAppService($domainService, $categoryDomainService);
        $result = $service->create($dataIsolation, $request);

        $this->assertSame('PPT-CATE-business', $result->getCategoryCode());
    }

    public function testAdminQueriesResolveCategoriesForCurrentPage(): void
    {
        $dataIsolation = $this->makeDataIsolation('OFFICIAL_ORG', ['OFFICIAL_ORG']);
        $request = new TestAdminQuerySlidesTemplateRequest();

        $template = new SlidesTemplateEntity();
        $template->setId(123)
            ->setOrganizationCode('OFFICIAL_ORG')
            ->setCode('PPT-65f2c8a42d7b0-12345678')
            ->setCategoryCode('PPT-CATE-business')
            ->setThumbnailFileKey('');

        $uncategorizedTemplate = new SlidesTemplateEntity();
        $uncategorizedTemplate->setId(124)
            ->setOrganizationCode('OFFICIAL_ORG')
            ->setCode('PPT-65f2c8a42d7b0-87654321')
            ->setThumbnailFileKey('');

        $category = new SlidesTemplateCategoryEntity();
        $category->setId(456)
            ->setOrganizationCode('OFFICIAL_ORG')
            ->setCode('PPT-CATE-business')
            ->setNameI18n(['zh_CN' => '商务', 'en_US' => 'Business']);

        $domainService = $this->createMock(SlidesTemplateDomainService::class);
        $domainService
            ->expects($this->once())
            ->method('queries')
            ->with(
                $this->callback(static fn (SlidesTemplateDataIsolation $actual): bool => $actual->getCurrentOrganizationCode() === 'OFFICIAL_ORG'),
                $this->isInstanceOf(SlidesTemplateQuery::class),
                $this->callback(static fn (Page $page): bool => $page->getPage() === 1 && $page->getPageNum() === 20)
            )
            ->willReturn(['total' => 2, 'list' => [$template, $uncategorizedTemplate]]);

        $categoryDomainService = new TestSlidesTemplateCategoryDomainService([
            'PPT-CATE-business' => $category,
        ]);

        $service = $this->makeAdminSlidesTemplateAppService($domainService, $categoryDomainService);
        $result = $service->queries($dataIsolation, $request);

        $this->assertSame([$template, $uncategorizedTemplate], $result['list']);
        $this->assertSame(['PPT-CATE-business' => $category], $result['categories']);
        $this->assertCount(1, $categoryDomainService->findByCodesCalls);
        $this->assertSame(['PPT-CATE-business'], $categoryDomainService->findByCodesCalls[0]['codes']);
    }

    public function testAdminUpdateKeepsExistingSourceTypeAndBaseUsageCount(): void
    {
        $dataIsolation = $this->makeDataIsolation('OFFICIAL_ORG', ['OFFICIAL_ORG']);
        $request = $this->createMock(SaveSlidesTemplateRequest::class);
        $request->method('getLabel')->willReturn([
            'zh_CN' => '职场白皮书',
            'en_US' => 'Corporate Whitepaper',
        ]);
        $request->method('getDescription')->willReturn([
            'zh_CN' => '适用于企业汇报。',
            'en_US' => 'For business reviews.',
        ]);
        $request->method('getThumbnailFileKey')->willReturn('');
        $request->method('getCollageFileKey')->willReturn(null);
        $request->method('getTemplateFileKey')->willReturn('slides/templates/business.zip');
        $request->method('getPreviewUrl')->willReturn(null);
        $request->method('getStatus')->willReturn(SlidesTemplateStatus::Enabled->value);
        $request->method('getSort')->willReturn(100);

        $existing = new SlidesTemplateEntity();
        $existing->setId(123)
            ->setOrganizationCode('OFFICIAL_ORG')
            ->setCode('PPT-65f2c8a42d7b0-12345678')
            ->setSourceType(SlidesTemplateSourceType::System)
            ->setBaseUsageCount(41)
            ->setActualUsageCount(9)
            ->setCreatedUid('system');

        $capturedTemplate = null;
        $domainService = $this->createMock(SlidesTemplateDomainService::class);
        $domainService
            ->expects($this->once())
            ->method('findByIdOrFail')
            ->with($this->isInstanceOf(SlidesTemplateDataIsolation::class), 123)
            ->willReturn($existing);
        $domainService
            ->expects($this->once())
            ->method('update')
            ->willReturnCallback(static function (SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateEntity $entity) use (&$capturedTemplate): SlidesTemplateEntity {
                $capturedTemplate = $entity;
                return $entity;
            });

        $service = $this->makeAdminSlidesTemplateAppService($domainService);
        $result = $service->update($dataIsolation, 123, $request);

        $this->assertSame($capturedTemplate, $result);
        $this->assertSame(SlidesTemplateSourceType::System, $result->getSourceType());
        $this->assertSame('system', $result->getCreatedUid());
        $this->assertSame('user-1', $result->getUpdatedUid());
        $this->assertSame(41, $result->getBaseUsageCount());
        $this->assertSame(9, $result->getActualUsageCount());
    }

    public function testAdminCreateThrowsWhenThumbnailPublicUrlCannotBeResolved(): void
    {
        $dataIsolation = $this->makeDataIsolation('OFFICIAL_ORG', ['OFFICIAL_ORG']);
        $request = $this->createMock(SaveSlidesTemplateRequest::class);
        $request->method('getLabel')->willReturn([
            'zh_CN' => '职场白皮书',
            'en_US' => 'Corporate Whitepaper',
        ]);
        $request->method('getDescription')->willReturn([
            'zh_CN' => '适用于企业汇报。',
            'en_US' => 'For business reviews.',
        ]);
        $request->method('getThumbnailFileKey')->willReturn('slides/thumbnails/missing.png');
        $request->method('getCollageFileKey')->willReturn(null);
        $request->method('getTemplateFileKey')->willReturn('slides/templates/business.zip');
        $request->method('getPreviewUrl')->willReturn(null);
        $request->method('getStatus')->willReturn(SlidesTemplateStatus::Enabled->value);
        $request->method('getSort')->willReturn(100);
        $request->method('getTagCodes')->willReturn([]);
        $request->method('hasTagCodes')->willReturn(false);

        $domainService = $this->createMock(SlidesTemplateDomainService::class);
        $domainService->expects($this->never())->method('create');

        $service = $this->makeAdminSlidesTemplateAppService($domainService, missingPublicFileKeys: ['slides/thumbnails/missing.png']);

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(SlidesTemplateErrorCode::VALIDATE_FAILED->value);
        $this->expectExceptionMessage('slides_template.thumbnail_file_url_generate_failed');

        $service->create($dataIsolation, $request);
    }

    public function testAdminUpdateThrowsWhenThumbnailPublicUrlCannotBeResolved(): void
    {
        $dataIsolation = $this->makeDataIsolation('OFFICIAL_ORG', ['OFFICIAL_ORG']);
        $request = $this->createMock(SaveSlidesTemplateRequest::class);
        $request->method('getLabel')->willReturn([
            'zh_CN' => '职场白皮书',
            'en_US' => 'Corporate Whitepaper',
        ]);
        $request->method('getDescription')->willReturn([
            'zh_CN' => '适用于企业汇报。',
            'en_US' => 'For business reviews.',
        ]);
        $request->method('getThumbnailFileKey')->willReturn('slides/thumbnails/missing.png');
        $request->method('getCollageFileKey')->willReturn(null);
        $request->method('getTemplateFileKey')->willReturn('slides/templates/business.zip');
        $request->method('getPreviewUrl')->willReturn(null);
        $request->method('getStatus')->willReturn(SlidesTemplateStatus::Enabled->value);
        $request->method('getSort')->willReturn(100);
        $request->method('hasTagCodes')->willReturn(false);

        $existing = new SlidesTemplateEntity();
        $existing->setId(123)
            ->setOrganizationCode('OFFICIAL_ORG')
            ->setCode('PPT-65f2c8a42d7b0-12345678')
            ->setSourceType(SlidesTemplateSourceType::System)
            ->setThumbnailFileKey('slides/thumbnails/original.png')
            ->setActualUsageCount(9)
            ->setCreatedUid('system');

        $domainService = $this->createMock(SlidesTemplateDomainService::class);
        $domainService
            ->expects($this->once())
            ->method('findByIdOrFail')
            ->with($this->isInstanceOf(SlidesTemplateDataIsolation::class), 123)
            ->willReturn($existing);
        $domainService->expects($this->never())->method('update');

        $service = $this->makeAdminSlidesTemplateAppService($domainService, missingPublicFileKeys: ['slides/thumbnails/missing.png']);

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(SlidesTemplateErrorCode::VALIDATE_FAILED->value);
        $this->expectExceptionMessage('slides_template.thumbnail_file_url_generate_failed');

        $service->update($dataIsolation, 123, $request);
    }

    public function testAdminCreateThrowsWhenTemplatePrivateUrlCannotBeResolved(): void
    {
        $dataIsolation = $this->makeDataIsolation('OFFICIAL_ORG', ['OFFICIAL_ORG']);
        $request = $this->createMock(SaveSlidesTemplateRequest::class);
        $request->method('getLabel')->willReturn([
            'zh_CN' => '职场白皮书',
            'en_US' => 'Corporate Whitepaper',
        ]);
        $request->method('getDescription')->willReturn([
            'zh_CN' => '适用于企业汇报。',
            'en_US' => 'For business reviews.',
        ]);
        $request->method('getThumbnailFileKey')->willReturn('slides/thumbnails/business.png');
        $request->method('getCollageFileKey')->willReturn(null);
        $request->method('getTemplateFileKey')->willReturn('slides/templates/missing.zip');
        $request->method('getPreviewUrl')->willReturn(null);
        $request->method('getStatus')->willReturn(SlidesTemplateStatus::Enabled->value);
        $request->method('getSort')->willReturn(100);
        $request->method('getTagCodes')->willReturn([]);
        $request->method('hasTagCodes')->willReturn(false);

        $domainService = $this->createMock(SlidesTemplateDomainService::class);
        $domainService->expects($this->never())->method('create');

        $service = $this->makeAdminSlidesTemplateAppService($domainService, missingPrivateFileKeys: ['slides/templates/missing.zip']);

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(SlidesTemplateErrorCode::VALIDATE_FAILED->value);
        $this->expectExceptionMessage('slides_template.template_file_url_generate_failed');

        $service->create($dataIsolation, $request);
    }

    public function testAdminUpdateThrowsWhenTemplatePrivateUrlCannotBeResolved(): void
    {
        $dataIsolation = $this->makeDataIsolation('OFFICIAL_ORG', ['OFFICIAL_ORG']);
        $request = $this->createMock(SaveSlidesTemplateRequest::class);
        $request->method('getLabel')->willReturn([
            'zh_CN' => '职场白皮书',
            'en_US' => 'Corporate Whitepaper',
        ]);
        $request->method('getDescription')->willReturn([
            'zh_CN' => '适用于企业汇报。',
            'en_US' => 'For business reviews.',
        ]);
        $request->method('getThumbnailFileKey')->willReturn('slides/thumbnails/business.png');
        $request->method('getCollageFileKey')->willReturn(null);
        $request->method('getTemplateFileKey')->willReturn('slides/templates/missing.zip');
        $request->method('getPreviewUrl')->willReturn(null);
        $request->method('getStatus')->willReturn(SlidesTemplateStatus::Enabled->value);
        $request->method('getSort')->willReturn(100);
        $request->method('hasTagCodes')->willReturn(false);

        $existing = new SlidesTemplateEntity();
        $existing->setId(123)
            ->setOrganizationCode('OFFICIAL_ORG')
            ->setCode('PPT-65f2c8a42d7b0-12345678')
            ->setSourceType(SlidesTemplateSourceType::System)
            ->setTemplateFileKey('slides/templates/original.zip')
            ->setThumbnailFileKey('slides/thumbnails/original.png')
            ->setActualUsageCount(9)
            ->setCreatedUid('system');

        $domainService = $this->createMock(SlidesTemplateDomainService::class);
        $domainService
            ->expects($this->once())
            ->method('findByIdOrFail')
            ->with($this->isInstanceOf(SlidesTemplateDataIsolation::class), 123)
            ->willReturn($existing);
        $domainService->expects($this->never())->method('update');

        $service = $this->makeAdminSlidesTemplateAppService($domainService, missingPrivateFileKeys: ['slides/templates/missing.zip']);

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(SlidesTemplateErrorCode::VALIDATE_FAILED->value);
        $this->expectExceptionMessage('slides_template.template_file_url_generate_failed');

        $service->update($dataIsolation, 123, $request);
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

    private function makeAuthorization(string $organizationCode, string $userId, string $nickname): MagicUserAuthorization
    {
        $authorization = new MagicUserAuthorization();
        $authorization->setOrganizationCode($organizationCode);
        $authorization->setId($userId);
        $authorization->setNickname($nickname);
        $authorization->setMagicId('magic-1');
        $authorization->setMagicEnvId(0);
        return $authorization;
    }

    private function makeFileUrlRequest(string $userName = 'user-1'): SlidesTemplateFileUrlRequestDTO
    {
        $request = new SlidesTemplateFileUrlRequestDTO();
        $request->setAccessToken('test-token');
        $request->setBusinessParams([
            'organization_code' => 'CURRENT_ORG',
            'user_id' => 'user-1',
            'user_name' => $userName,
        ]);
        return $request;
    }

    private function makeTaxonomyRequest(): SlidesTemplateTaxonomyRequestDTO
    {
        $request = new SlidesTemplateTaxonomyRequestDTO();
        $request->setAccessToken('test-token');
        $request->setBusinessParams([
            'organization_code' => 'CURRENT_ORG',
            'user_id' => 'user-1',
            'user_name' => 'user-1',
        ]);
        return $request;
    }

    private function makeAdminSlidesTemplateAppService(
        SlidesTemplateDomainService $domainService,
        ?SlidesTemplateCategoryDomainService $categoryDomainService = null,
        array $missingPublicFileKeys = [],
        array $missingPrivateFileKeys = [],
    ): AdminSlidesTemplateAppService {
        if ($categoryDomainService === null) {
            $categoryDomainService = $this->createMock(SlidesTemplateCategoryDomainService::class);
            $categoryDomainService->expects($this->never())->method('findByCodeOrFail');
        }

        $tagDomainService = $this->createMock(SlidesTemplateTagDomainService::class);
        $tagDomainService->method('findEnabledByCodes')->willReturn([]);
        $tagDomainService->method('fillTemplateTags');
        $tagDomainService->method('syncTemplateTagsByCodes');
        $tagDomainService->method('deleteTemplateTags');

        $colorExtractor = $this->createMock(SlidesTemplateColorExtractor::class);
        $colorExtractor->method('extractColors')->willReturn([]);
        /** @var SlidesTemplateFavoriteDomainService $favoriteDomainService */
        $favoriteDomainService = (new ReflectionClass(SlidesTemplateFavoriteDomainService::class))->newInstanceWithoutConstructor();
        /** @var SlidesTemplateVectorIndexDomainService $vectorIndexDomainService */
        $vectorIndexDomainService = (new ReflectionClass(SlidesTemplateVectorIndexDomainService::class))->newInstanceWithoutConstructor();
        $service = new TestableAdminSlidesTemplateAppService(
            $domainService,
            $categoryDomainService,
            $tagDomainService,
            $colorExtractor,
            $favoriteDomainService,
            $vectorIndexDomainService,
        );
        $service->missingPublicFileKeys = $missingPublicFileKeys;
        $service->missingPrivateFileKeys = $missingPrivateFileKeys;

        return $service;
    }
}

class TestableSlidesTemplateAppService extends PublicSlidesTemplateAppService
{
    public array $fileLinkCalls = [];

    public array $publicFileLinkCalls = [];

    private SlidesTemplateDomainService $queryDomainService;

    public function __construct(
        SlidesTemplateDomainService $slidesTemplateDomainService,
        ?SlidesTemplateTagDomainService $slidesTemplateTagDomainService = null,
    ) {
        /** @var SlidesTemplateCategoryDomainService $categoryDomainService */
        $categoryDomainService = (new ReflectionClass(SlidesTemplateCategoryDomainService::class))->newInstanceWithoutConstructor();
        /** @var SlidesTemplateFavoriteDomainService $favoriteDomainService */
        $favoriteDomainService = (new ReflectionClass(SlidesTemplateFavoriteDomainService::class))->newInstanceWithoutConstructor();
        /** @var ResourceAccessLogDomainService $resourceAccessLogDomainService */
        $resourceAccessLogDomainService = (new ReflectionClass(ResourceAccessLogDomainService::class))->newInstanceWithoutConstructor();
        /** @var SlidesTemplateProjectExportService $projectPublishService */
        $projectPublishService = (new ReflectionClass(SlidesTemplateProjectExportService::class))->newInstanceWithoutConstructor();
        /** @var SlidesTemplateVectorIndexDomainService $vectorIndexDomainService */
        $vectorIndexDomainService = (new ReflectionClass(SlidesTemplateVectorIndexDomainService::class))->newInstanceWithoutConstructor();
        $this->queryDomainService = $slidesTemplateDomainService;
        parent::__construct(
            $slidesTemplateDomainService,
            $slidesTemplateTagDomainService ?? new class extends SlidesTemplateTagDomainService {
                public function __construct()
                {
                }

                public function fillTemplateTags(SlidesTemplateDataIsolation $dataIsolation, array $templates, ?SlidesTemplateTagStatus $tagStatus = null): void
                {
                }
            },
            $categoryDomainService,
            $favoriteDomainService,
            $resourceAccessLogDomainService,
            $projectPublishService,
            $vectorIndexDomainService,
        );
    }

    public function queries(Authenticatable|BaseDataIsolation $authorization, PublicQuerySlidesTemplateRequest $request): array
    {
        $dataIsolation = $this->createSlidesTemplateDataIsolation($authorization);
        $dataIsolation->setContainOfficialOrganization(true);
        $query = $this->createPublicQueryForTest($request);
        $page = $this->createListPage($request->getPage(), $request->getPageSize());
        $page->setTotal(false);
        $result = $this->queryDomainService->queries($dataIsolation, $query, $page);
        $this->resolveListImageUrls($result['list']);

        return [
            'page' => $page,
            'list' => $result['list'],
            'favorite_codes' => [],
        ];
    }

    public function getPrivateFileLinks(string $organizationCode, array $fileLinks): array
    {
        $this->fileLinkCalls[] = [$organizationCode, $fileLinks];

        $result = [];
        foreach ($fileLinks as $fileLink) {
            $result[$fileLink] = new FileLink(
                $fileLink,
                'https://signed.example/' . $organizationCode . '/' . $fileLink,
                time() + 3600
            );
        }
        return $result;
    }

    public function getPublicFileLinks(string $organizationCode, array $fileLinks): array
    {
        $this->publicFileLinkCalls[] = [$organizationCode, $fileLinks];

        $result = [];
        foreach ($fileLinks as $fileLink) {
            $result[$fileLink] = new FileLink(
                $fileLink,
                'https://public.example/' . $organizationCode . '/' . $fileLink,
                time() + 3600
            );
        }
        return $result;
    }

    private function createPublicQueryForTest(PublicQuerySlidesTemplateRequest $request): SlidesTemplateQuery
    {
        $query = new SlidesTemplateQuery();
        $query->setScope($request->getScope());
        $query->setKeyword($request->getKeyword());
        $query->setSearchType($request->getSearchType());
        $query->setCode($request->getCode());
        $query->setCategoryCode($request->getCategoryCode());
        $query->setTagCodes($request->getTagCodes());
        $query->setTagMatch(SlidesTemplateTagMatch::tryFrom($request->getTagMatch()) ?? SlidesTemplateTagMatch::Any);
        if ($query->getScope() === SlidesTemplateQueryScope::Official) {
            $query->setStatus(SlidesTemplateStatus::Enabled->value);
        }
        return $query;
    }
}

class TestableModelGatewaySlidesTemplateAppService extends ModelGatewaySlidesTemplateAppService
{
    public array $fileLinkCalls = [];

    public array $dispatchedEvents = [];

    public function __construct(
        SlidesTemplateDomainService $slidesTemplateDomainService,
        PointComponentInterface $pointComponent,
        ?SlidesTemplateCategoryDomainService $slidesTemplateCategoryDomainService = null,
        ?SlidesTemplateTagDomainService $slidesTemplateTagDomainService = null,
    ) {
        $reflection = new ReflectionClass(ModelGatewaySlidesTemplateAppService::class);
        $reflection->getProperty('slidesTemplateDomainService')->setValue($this, $slidesTemplateDomainService);
        $reflection->getProperty('pointComponent')->setValue($this, $pointComponent);
        if ($slidesTemplateCategoryDomainService !== null) {
            $reflection->getProperty('slidesTemplateCategoryDomainService')->setValue($this, $slidesTemplateCategoryDomainService);
        }
        if ($slidesTemplateTagDomainService !== null) {
            $reflection->getProperty('slidesTemplateTagDomainService')->setValue($this, $slidesTemplateTagDomainService);
        }
    }

    public function createModelGatewayDataIsolationByAccessToken(string $inputAccessToken, array $businessParams = []): ModelGatewayDataIsolation
    {
        $dataIsolation = ModelGatewayDataIsolation::create(
            (string) ($businessParams['organization_code'] ?? 'CURRENT_ORG'),
            (string) ($businessParams['user_id'] ?? 'user-1'),
        );
        $dataIsolation->setUserName((string) ($businessParams['user_name'] ?? 'user-1'));
        $dataIsolation->setOfficialOrganizationCodes(['OFFICIAL_ORG']);
        return $dataIsolation;
    }

    public function getPrivateFileLinks(string $organizationCode, array $fileLinks): array
    {
        $this->fileLinkCalls[] = [$organizationCode, $fileLinks];

        $result = [];
        foreach ($fileLinks as $fileLink) {
            $result[$fileLink] = new FileLink(
                $fileLink,
                'https://signed.example/' . $organizationCode . '/' . $fileLink,
                time() + 3600
            );
        }
        return $result;
    }

    protected function dispatchSlidesTemplateUsedEvent(
        ModelGatewayDataIsolation $dataIsolation,
        SlidesTemplateEntity $template,
        float $startTime,
        array $businessParams = [],
    ): void {
        $requestId = trim(CoContext::getRequestId());
        $this->dispatchedEvents[] = new SlidesTemplateUsedEvent(
            organizationCode: $dataIsolation->getCurrentOrganizationCode(),
            sourceId: SourceId::SLIDES_TEMPLATE_USE,
            callTime: (int) round($startTime * 1000),
            userId: $dataIsolation->getCurrentUserId(),
            userName: $dataIsolation->getUserName(),
            requestId: $requestId === '' ? IdGenerator::getUniqueId32() : $requestId,
            template: $template,
            businessParams: $businessParams,
        );
    }
}

class TestPublicQuerySlidesTemplateRequest extends PublicQuerySlidesTemplateRequest
{
    public function __construct(
        private readonly ?string $categoryCode = null,
        private readonly ?string $keyword = null,
        private readonly int $page = 1,
        private readonly int $pageSize = 20,
    ) {
    }

    public function getKeyword(): ?string
    {
        return $this->keyword;
    }

    public function getScope(): string
    {
        return 'official';
    }

    public function getCode(): ?string
    {
        return null;
    }

    public function getCategoryCode(): ?string
    {
        return $this->categoryCode;
    }

    public function getPage(): int
    {
        return $this->page;
    }

    public function getPageSize(): int
    {
        return $this->pageSize;
    }

    public function getTagCodes(): array
    {
        return [];
    }

    public function getTagMatch(): string
    {
        return 'any';
    }
}

class TestAdminQuerySlidesTemplateRequest extends AdminQuerySlidesTemplateRequest
{
    public function __construct()
    {
    }

    public function getPage(): int
    {
        return 1;
    }

    public function getPageSize(): int
    {
        return 20;
    }

    public function getKeyword(): ?string
    {
        return null;
    }

    public function getCode(): ?string
    {
        return null;
    }

    public function getCategoryCode(): ?string
    {
        return null;
    }

    public function getStatus(): ?int
    {
        return null;
    }

    public function getTagCodes(): array
    {
        return [];
    }

    public function getTagMatch(): string
    {
        return 'any';
    }
}

class TestSlidesTemplateCategoryDomainService extends SlidesTemplateCategoryDomainService
{
    public array $findByCodesCalls = [];

    /**
     * @param array<string, SlidesTemplateCategoryEntity> $categoriesByCode
     */
    public function __construct(
        private readonly array $categoriesByCode,
    ) {
    }

    /**
     * @return SlidesTemplateCategoryEntity[]
     */
    public function findByCodes(SlidesTemplateDataIsolation $dataIsolation, array $codes): array
    {
        $this->findByCodesCalls[] = [
            'dataIsolation' => $dataIsolation,
            'codes' => $codes,
        ];

        $categories = [];
        foreach ($codes as $code) {
            if (isset($this->categoriesByCode[$code])) {
                $categories[] = $this->categoriesByCode[$code];
            }
        }
        return $categories;
    }
}

class TestableAdminSlidesTemplateAppService extends AdminSlidesTemplateAppService
{
    public array $missingPublicFileKeys = [];

    public array $missingPrivateFileKeys = [];

    public array $publicFileLinkCalls = [];

    public array $privateFileLinkCalls = [];

    public function getPublicFileLinks(string $organizationCode, array $fileLinks): array
    {
        $this->publicFileLinkCalls[] = [$organizationCode, $fileLinks];

        $result = [];
        foreach ($fileLinks as $fileLink) {
            if (in_array($fileLink, $this->missingPublicFileKeys, true)) {
                continue;
            }

            $result[$fileLink] = new FileLink(
                $fileLink,
                'https://public.example/' . $organizationCode . '/' . $fileLink,
                time() + 3600
            );
        }

        return $result;
    }

    public function getPrivateFileLinks(string $organizationCode, array $fileLinks): array
    {
        $this->privateFileLinkCalls[] = [$organizationCode, $fileLinks];

        $result = [];
        foreach ($fileLinks as $fileLink) {
            if (in_array($fileLink, $this->missingPrivateFileKeys, true)) {
                continue;
            }

            $result[$fileLink] = new FileLink(
                $fileLink,
                'https://signed.example/' . $organizationCode . '/' . $fileLink,
                time() + 3600
            );
        }

        return $result;
    }

    protected function transaction(callable $callback): mixed
    {
        return $callback();
    }
}

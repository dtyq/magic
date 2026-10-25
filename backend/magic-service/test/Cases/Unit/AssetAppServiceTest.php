<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit;

use App\Application\Asset\Service\AdminAssetAppService;
use App\Application\Asset\Service\AssetAppService;
use App\Application\Asset\Support\AssetVisualPrecheck;
use App\Application\Asset\Support\ProjectFileMaterializer;
use App\Domain\Asset\Contract\AssetProviderInterface;
use App\Domain\Asset\Entity\AssetDataIsolation;
use App\Domain\Asset\Entity\AssetEntity;
use App\Domain\Asset\Entity\AssetTagEntity;
use App\Domain\Asset\Entity\ProviderAssetEntity;
use App\Domain\Asset\Entity\ValueObject\AssetKind;
use App\Domain\Asset\Entity\ValueObject\AssetScope;
use App\Domain\Asset\Entity\ValueObject\Query\AssetQuery;
use App\Domain\Asset\Repository\Facade\AssetAgreementRepositoryInterface;
use App\Domain\Asset\Repository\Facade\AssetProviderAssetRepositoryInterface;
use App\Domain\Asset\Repository\Facade\AssetRepositoryInterface;
use App\Domain\Asset\Repository\Persistence\Model\AssetModel;
use App\Domain\Asset\Service\AssetDomainService;
use App\Domain\Asset\Service\AssetSearchTextBuilder;
use App\Domain\Asset\Service\AssetTagDomainService;
use App\Domain\Contact\Repository\Facade\MagicDepartmentUserRepositoryInterface;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\Permission\Entity\ResourceVisibilityEntity;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\PrincipalType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType;
use App\Domain\Permission\Repository\Facade\ResourceVisibilityRepositoryInterface;
use App\Domain\Permission\Service\ResourceVisibilityDomainService;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\ErrorCode\AssetErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Asset\DTO\Request\CreateAssetRequestDTO;
use App\Interfaces\Asset\DTO\Request\QueryAssetRequestDTO;
use App\Interfaces\Asset\DTO\Request\SaveAssetToLibraryRequestDTO;
use App\Interfaces\Asset\DTO\Request\UpdateAssetRequestDTO;
use App\Interfaces\Asset\DTO\Request\UpdatePersonalAssetRequestDTO;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\NullLogger;
use ReflectionMethod;
use ReflectionNamedType;
use Throwable;

/**
 * @internal
 */
final class AssetAppServiceTest extends TestCase
{
    private ?ContainerInterface $containerBeforeTest = null;

    protected function setUp(): void
    {
        parent::setUp();
        if (ApplicationContext::hasContainer()) {
            $this->containerBeforeTest = ApplicationContext::getContainer();
        }
    }

    protected function tearDown(): void
    {
        if ($this->containerBeforeTest !== null) {
            ApplicationContext::setContainer($this->containerBeforeTest);
        }
        parent::tearDown();
    }

    public function testI18nTextFallsBackToDefaultLanguage(): void
    {
        $container = ApplicationContext::getContainer();
        ApplicationContext::setContainer(new class implements ContainerInterface {
            public function get(string $id): object
            {
                return new class {};
            }

            public function has(string $id): bool
            {
                return false;
            }
        });
        try {
            $asset = new AssetEntity(['name_i18n' => ['default' => '默认名称'], 'description_i18n' => ['en' => 'English']]);
            self::assertSame('默认名称', $asset->getI18nName('zh-CN'));
            self::assertSame('English', $asset->getI18nDescription('en'));
        } finally {
            ApplicationContext::setContainer($container);
        }
    }

    public function testAssetKindValueObjectSupportsGroup(): void
    {
        self::assertTrue(AssetKind::GROUP->isGroup());
        self::assertSame(AssetKind::ASSET, AssetKind::from('ASSET'));
    }

    public function testAssetModelQueryCanInitializeModelEvents(): void
    {
        self::assertStringContainsString('magic_assets', AssetModel::query()->toSql());
    }

    public function testTypedHydrationNormalizesIdentifiersAndDates(): void
    {
        $asset = new AssetEntity(['id' => '7', 'parent_id' => '8']);
        self::assertSame(7, $asset->getId());
        self::assertSame(8, $asset->getParentId());
        $provider = new ProviderAssetEntity(['asset_id' => '9', 'id' => '10']);
        self::assertSame(9, $provider->getAssetId());
    }

    public function testProviderActiveWithoutIdIsRejected(): void
    {
        ApplicationContext::setContainer(new class implements ContainerInterface {
            public function get(string $id): object
            {
                if ($id === ConfigInterface::class) {
                    return new class implements ConfigInterface {
                        public function get(string $key, mixed $default = null): mixed
                        {
                            return $key === 'error_message'
                                ? [
                                    'exception_class' => BusinessException::class,
                                    'error_code_mapper' => [AssetErrorCode::class => [48000, 48999]],
                                ]
                                : $default;
                        }

                        public function has(string $keys): bool
                        {
                            return $keys === 'error_message';
                        }

                        public function set(string $key, mixed $value): void
                        {
                        }
                    };
                }
                return new class {};
            }

            public function has(string $id): bool
            {
                return $id === ConfigInterface::class;
            }
        });
        $provider = new class implements AssetProviderInterface {
            public function createAsset(array $payload): array
            {
                return ['status' => 'ACTIVE'];
            }

            public function getAssetStatus(string $providerAssetId, ?string $projectName = null): array
            {
                return [];
            }

            public function extractComplianceFailedReason(array $metadata, string $providerStatus): string
            {
                return 'provider failure';
            }

            public function createAssetGroup(array $payload): array
            {
                return ['provider_group_id' => 'group-test'];
            }

            public function deleteAsset(string $providerAssetId, string $projectName): bool
            {
                return true;
            }

            public function deleteAssetGroup(string $groupId, string $projectName): bool
            {
                return true;
            }

            public function getProviderCode(): string
            {
                return 'ark';
            }
        };
        $this->expectException(Throwable::class);
        $agreement = $this->createMock(AssetAgreementRepositoryInterface::class);
        $agreement->method('hasAccepted')->willReturn(true);
        $domainService = new AssetDomainService(
            $this->createMock(AssetRepositoryInterface::class),
            $this->createMock(AssetProviderAssetRepositoryInterface::class),
            $agreement,
            new NullLogger(),
            $this->createMock(AiAbilityDomainService::class),
            new AssetSearchTextBuilder(),
        );
        $authorization = $this->createMock(AssetDataIsolation::class);
        $authorization->method('getCurrentOrganizationCode')->willReturn('org-a');
        $authorization->method('getCurrentUserId')->willReturn('user-a');
        $domainService->createPersonal($authorization, new AssetEntity(['file_key' => 'asset.png']));
    }

    public function testDomainWriteMethodsReceiveEntities(): void
    {
        $update = new ReflectionMethod(AssetDomainService::class, 'update');
        self::assertSame(
            AssetEntity::class,
            (string) $update->getParameters()[1]->getType(),
        );
    }

    public function testIdOnlyDomainMethodsReceiveScalarIds(): void
    {
        foreach (['find', 'findPublic', 'deletePersonal', 'deletePublic'] as $methodName) {
            $method = new ReflectionMethod(AssetDomainService::class, $methodName);
            $types = array_map(
                static fn (ReflectionNamedType $type): string => $type->getName(),
                $method->getParameters()[1]->getType()->getTypes(),
            );
            sort($types);
            self::assertSame(
                ['int', 'string'],
                $types,
                $methodName,
            );
        }
    }

    public function testPrivateAssetFileUrlIsResolvedByApplicationService(): void
    {
        $asset = new AssetEntity([
            'id' => 12,
            'organization_code' => 'org-a',
            'file_key' => 'assets/example.png',
        ]);
        $service = new class(...$this->assetAppServiceArgs($this->createMock(AssetDomainService::class))) extends AssetAppService {
            public function resolve(array $assets): void
            {
                $this->resolveAssetFileUrls($assets);
            }

            public function getPrivateFileLinks(string $organizationCode, array $fileLinks): array
            {
                return [
                    'assets/example.png' => new FileLink(
                        'assets/example.png',
                        'https://example.test/assets/example.png',
                        3600,
                    ),
                ];
            }
        };

        $service->resolve([$asset]);

        self::assertSame('https://example.test/assets/example.png', $asset->getFileUrl());
    }

    public function testCreateResolvesPrivateFileUrlBeforeEntityIsPersisted(): void
    {
        $service = new class(...$this->assetAppServiceArgs($this->createMock(AssetDomainService::class))) extends AssetAppService {
            public function resolveForCreate(CreateAssetRequestDTO $requestDTO): AssetEntity
            {
                $asset = $this->createAssetEntity($requestDTO, false, 'org-a');
                $this->resolveAssetFileUrls([$asset]);
                return $asset;
            }

            public function getPrivateFileLinks(string $organizationCode, array $fileLinks): array
            {
                return [
                    'org-a/private/thumbnail.png' => new FileLink(
                        'org-a/private/thumbnail.png',
                        'https://example.test/org-a/private/thumbnail.png',
                        3600,
                    ),
                ];
            }
        };

        $asset = $service->resolveForCreate(new CreateAssetRequestDTO([
            'file_key' => 'org-a/private/thumbnail.png',
        ]));

        self::assertNull($asset->getId());
        self::assertSame(
            'https://example.test/org-a/private/thumbnail.png',
            $asset->getFileUrl(),
        );
        self::assertSame(
            'https://example.test/org-a/private/thumbnail.png',
            $asset->toArray()['file_url'],
        );
    }

    public function testCreateLeavesFileUrlNullWhenFileCannotBeResolved(): void
    {
        $service = new class(...$this->assetAppServiceArgs($this->createMock(AssetDomainService::class))) extends AssetAppService {
            public function resolveForCreate(CreateAssetRequestDTO $requestDTO): AssetEntity
            {
                $asset = $this->createAssetEntity($requestDTO, false, 'org-a');
                $this->resolveAssetFileUrls([$asset]);
                return $asset;
            }

            public function getPrivateFileLinks(string $organizationCode, array $fileLinks): array
            {
                return [];
            }
        };

        // 应用层不抛异常，交给第三方适配器按 file_required(48009) 返回，避免列表/详情因单个文件失效整体失败。
        $asset = $service->resolveForCreate(new CreateAssetRequestDTO([
            'file_key' => 'org-a/private-marker/missing.png',
        ]));

        self::assertNull($asset->getFileUrl());
    }

    public function testApplicationServiceConvertsCreateDTOToAssetEntity(): void
    {
        $asset = new AssetEntity(['id' => 9, 'file_key' => 'images/example.png']);
        $domainService = $this->createMock(AssetDomainService::class);
        $domainService->expects(self::once())->method('createPersonal')->with(
            self::isInstanceOf(AssetDataIsolation::class),
            self::callback(static fn (AssetEntity $entity): bool => $entity->getFileKey() === 'images/example.png'),
        )->willReturn($asset);

        $service = new class(...$this->assetAppServiceArgs($domainService)) extends AssetAppService {
            public function getPrivateFileLinks(string $organizationCode, array $fileLinks): array
            {
                return [
                    'images/example.png' => new FileLink(
                        'images/example.png',
                        'https://example.test/images/example.png',
                        3600,
                    ),
                ];
            }
        };
        self::assertSame($asset, $service->createPersonalAsset(
            $this->createMock(AssetDataIsolation::class),
            new CreateAssetRequestDTO(['file_key' => 'images/example.png']),
        ));
        self::assertSame(
            'https://example.test/images/example.png',
            $asset->getFileUrl(),
        );
    }

    public function testAssetCreationRejectsMissingUploadFileWithSemanticError(): void
    {
        $service = new class(...$this->assetAppServiceArgs($this->createMock(AssetDomainService::class))) extends AssetAppService {
            public function createForTest(CreateAssetRequestDTO $requestDTO): AssetEntity
            {
                return $this->createAssetEntity($requestDTO);
            }
        };

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(48009);
        $this->expectExceptionMessage('请先上传素材文件');
        $service->createForTest(new CreateAssetRequestDTO([
            'asset_kind' => 'ASSET',
            'file_key' => '   ',
        ]));
    }

    public function testApplicationServiceSignsAgreementThroughDomainService(): void
    {
        $authorization = $this->createMock(AssetDataIsolation::class);
        $domainService = $this->createMock(AssetDomainService::class);
        $domainService->expects(self::once())->method('signAgreement')->with($authorization);

        $service = new AssetAppService(...$this->assetAppServiceArgs($domainService));
        $service->signAgreement($authorization);
    }

    /**
     * 编辑会重建搜索文本，而搜索文本由「名称 + 描述 + 标签」整体构成：
     * 更新前必须把该素材现有标签加载回实体，否则只改名称就把标签关键词从搜索文本里抹掉了。
     */
    public function testUpdatePersonalAssetLoadsExistingTagsBeforeRebuildingSearchText(): void
    {
        $asset = new AssetEntity([
            'id' => 41,
            'organization_code' => 'org-a',
            'user_id' => 'user-1',
            'file_key' => 'org-a/private/image.png',
            'name_i18n' => ['default' => '旧名字'],
        ]);
        $tag = (new AssetTagEntity())->setNameI18n(['default' => '风景']);

        $tagDomainService = $this->createMock(AssetTagDomainService::class);
        $tagDomainService->expects(self::once())->method('findAssetTags')
            ->with(self::isInstanceOf(AssetDataIsolation::class), 41)
            ->willReturn([$tag]);

        $updated = null;
        $domainService = $this->createMock(AssetDomainService::class);
        $domainService->method('find')->willReturn($asset);
        $domainService->expects(self::once())->method('update')->willReturnCallback(
            static function (AssetDataIsolation $dataIsolation, AssetEntity $entity) use (&$updated): AssetEntity {
                $updated = $entity;
                return $entity;
            }
        );

        $service = $this->assetService($domainService, null, $tagDomainService);
        $service->updatePersonalAsset(
            $this->realAssetDataIsolation('org-a', 'user-1'),
            41,
            new UpdatePersonalAssetRequestDTO(['name' => '新名字']),
        );

        self::assertSame('新名字', $updated?->getI18nName('default'));
        self::assertSame([$tag], $updated?->getTags());
    }

    /**
     * 列表/详情的标签名必须按请求语言解析、缺失时回退 default，与标签树接口（AssetAssembler）同一口径。
     * 原先固定读 name_i18n['default']，非默认语言用户看到的始终是默认名。
     */
    public function testListResolvesTagNamesInCurrentLanguageWithDefaultFallback(): void
    {
        $asset = new AssetEntity([
            'id' => 51,
            'organization_code' => 'org-a',
            'user_id' => 'user-1',
            'file_key' => '',
        ]);
        $localized = (new AssetTagEntity())->setNameI18n(['default' => '风景', 'en_US' => 'Landscape']);
        $defaultOnly = (new AssetTagEntity())->setNameI18n(['default' => '人物']);

        $tagDomainService = $this->createMock(AssetTagDomainService::class);
        $tagDomainService->method('findTagsByAssetIds')->willReturn(['51' => [$localized, $defaultOnly]]);

        $domainService = $this->createMock(AssetDomainService::class);
        $domainService->method('queries')->willReturn(['total' => 1, 'list' => [$asset]]);
        $domainService->method('findProviderAssets')->willReturn([]);

        // 请求语言是 en_US：有 en_US 的取 en_US，只有 default 的回落 default。
        $isolation = $this->createMock(AssetDataIsolation::class);
        $isolation->method('getLanguage')->willReturn('en_US');
        $isolation->method('getCurrentUserId')->willReturn('user-1');
        $isolation->method('getCurrentOrganizationCode')->willReturn('org-a');
        $isolation->method('getOfficialOrganizationCodes')->willReturn([]);

        $result = $this->assetService($domainService, null, $tagDomainService)
            ->list($isolation, new QueryAssetRequestDTO(['scope' => 'PERSONAL']));

        self::assertSame([
            ['id' => '', 'name' => 'Landscape'],
            ['id' => '', 'name' => '人物'],
        ], $result['list'][0]->getTags());
    }

    public function testAdminAssetListResolvesPrivateFileUrls(): void
    {
        $asset = new AssetEntity([
            'id' => 13,
            'organization_code' => 'official',
            'file_key' => 'assets/admin.png',
        ]);
        $authorization = $this->createMock(AssetDataIsolation::class);
        $authorization->method('isOfficialOrganization')->willReturn(true);
        $domainService = $this->createMock(AssetDomainService::class);
        $domainService->expects(self::once())->method('queries')->willReturn([
            'total' => 1,
            'list' => [$asset],
        ]);
        $service = new class(...$this->adminAssetAppServiceArgs($domainService)) extends AdminAssetAppService {
            public function getPrivateFileLinks(string $organizationCode, array $fileLinks): array
            {
                return [
                    'assets/admin.png' => new FileLink(
                        'assets/admin.png',
                        'https://example.test/assets/admin.png',
                        3600,
                    ),
                ];
            }
        };

        $service->list($authorization, new QueryAssetRequestDTO());

        self::assertSame('https://example.test/assets/admin.png', $asset->getFileUrl());
    }

    /**
     * 团队分享 / 全部范围要先把「授权给我的资产主键」解析出来交给仓储做 IN 过滤。
     */
    public function testListResolvesGrantedAssetIdsForTeamAndAllScopes(): void
    {
        $authorization = $this->realAssetDataIsolation('org-a', 'user-1');
        $repository = $this->createMock(ResourceVisibilityRepositoryInterface::class);
        $repository->method('listByPrincipalIds')->willReturn([
            new ResourceVisibilityEntity(['resource_code' => '42']),
        ]);
        $domainService = $this->createMock(AssetDomainService::class);
        $collector = $this->collectQueries($domainService);

        $service = $this->assetService($domainService, $repository);
        $service->list($authorization, new QueryAssetRequestDTO(['scope' => 'TEAM']));
        $service->list($authorization, new QueryAssetRequestDTO(['scope' => 'ALL']));

        self::assertSame([
            [AssetScope::TEAM, ['42']],
            [AssetScope::ALL, ['42']],
        ], $collector->scopes);
    }

    /**
     * 个人与公开范围不依赖授权记录，不应触发可见性查询。
     */
    public function testListSkipsVisibilityLookupForPersonalAndPublicScopes(): void
    {
        $authorization = $this->realAssetDataIsolation('org-a', 'user-1');
        $repository = $this->createMock(ResourceVisibilityRepositoryInterface::class);
        $repository->expects(self::never())->method('listByPrincipalIds');
        $domainService = $this->createMock(AssetDomainService::class);
        $collector = $this->collectQueries($domainService);

        $service = $this->assetService($domainService, $repository);
        $service->list($authorization, new QueryAssetRequestDTO(['scope' => 'PERSONAL']));
        $service->list($authorization, new QueryAssetRequestDTO(['scope' => 'PUBLIC']));

        self::assertSame([
            [AssetScope::PERSONAL, []],
            [AssetScope::PUBLIC, []],
        ], $collector->scopes);
    }

    /**
     * 详情查询要把官方组织并入组织范围，官方公开资产才查得到。
     */
    public function testDetailIncludesOfficialOrganizationInIsolation(): void
    {
        $authorization = $this->realAssetDataIsolation('org-a', 'user-1');
        $authorization->setOfficialOrganizationCodes(['official']);
        $domainService = $this->createMock(AssetDomainService::class);
        $domainService->expects(self::once())->method('find')->with($authorization, 8, false)->willReturn(null);

        self::assertNull($this->assetService($domainService)->detail($authorization, 8));
        self::assertSame(['org-a', 'official'], $authorization->getOrganizationCodes());
    }

    /**
     * 团队分享的素材命中授权时，详情查询要带上「已授权」标记，否则列表点进去拿不到数据。
     */
    public function testDetailMarksGrantedSharedAsset(): void
    {
        $authorization = $this->realAssetDataIsolation('org-a', 'user-1');
        $repository = $this->createMock(ResourceVisibilityRepositoryInterface::class);
        $repository->method('listByPrincipalIds')->willReturn([
            new ResourceVisibilityEntity(['resource_code' => '8']),
        ]);
        $domainService = $this->createMock(AssetDomainService::class);
        $domainService->expects(self::once())->method('find')->with($authorization, 8, true)->willReturn(null);

        self::assertNull($this->assetService($domainService, $repository)->detail($authorization, 8));
    }

    public function testPersonalAssetCreationRegistersOwnerVisibility(): void
    {
        $asset = new AssetEntity(['id' => 9, 'organization_code' => 'org-a', 'file_key' => 'images/example.png']);
        $authorization = $this->realAssetDataIsolation('org-a', 'user-1');
        $domainService = $this->createMock(AssetDomainService::class);
        $domainService->method('createPersonal')->willReturn($asset);

        $repository = $this->createMock(ResourceVisibilityRepositoryInterface::class);
        $repository->expects(self::once())->method('listExistingPrincipalIdsByResourceAndType')->with(
            self::isInstanceOf(PermissionDataIsolation::class),
            ResourceType::ASSET,
            '9',
            PrincipalType::USER,
            ['user-1'],
        )->willReturn([]);
        $repository->expects(self::once())->method('batchInsertOrIgnore')->willReturn(1);

        $service = $this->assetService($domainService, $repository);
        self::assertSame($asset, $service->createPersonalAsset(
            $authorization,
            new CreateAssetRequestDTO(['file_key' => 'images/example.png']),
        ));
    }

    public function testSaveToLibraryRegistersOwnerAndProvidedVisibility(): void
    {
        $asset = new AssetEntity(['id' => 31, 'organization_code' => 'org-a', 'file_key' => 'images/example.png']);
        $authorization = $this->realAssetDataIsolation('org-a', 'user-1');
        $domainService = $this->createMock(AssetDomainService::class);
        // 保存到素材库只做本地落库，不触发第三方同步。
        $domainService->expects(self::once())->method('saveToLibrary')->willReturn($asset);

        $principals = [];
        $repository = $this->createMock(ResourceVisibilityRepositoryInterface::class);
        $repository->expects(self::exactly(2))->method('listExistingPrincipalIdsByResourceAndType')
            ->willReturnCallback(static function (...$arguments) use (&$principals): array {
                $principals[] = [$arguments[3], $arguments[4]];
                return [];
            });
        $repository->expects(self::exactly(2))->method('batchInsertOrIgnore')->willReturn(1);

        $service = $this->assetService($domainService, $repository);
        self::assertSame($asset, $service->saveToLibrary($authorization, new SaveAssetToLibraryRequestDTO([
            'name' => '示例素材',
            'file_key' => 'images/example.png',
            'visibility' => [
                'user_ids' => ['user-2'],
                'department_ids' => ['dept-1'],
            ],
        ])));

        // 本人始终可见，再叠加传入的用户；部门单独一条记录。
        self::assertSame([PrincipalType::USER, ['user-1', 'user-2']], $principals[0]);
        self::assertSame([PrincipalType::DEPARTMENT, ['dept-1']], $principals[1]);
    }

    /**
     * 保存响应必须和列表/详情一样带回 file_url（私有桶链接），否则前端存完立刻展示会拿到空图。
     */
    public function testSaveToLibraryResponseCarriesResolvedFileUrl(): void
    {
        $asset = new AssetEntity([
            'id' => 32,
            'organization_code' => 'org-a',
            'file_key' => 'org-a/private/library.png',
        ]);
        $authorization = $this->realAssetDataIsolation('org-a', 'user-1');
        $domainService = $this->createMock(AssetDomainService::class);
        $domainService->method('saveToLibrary')->willReturn($asset);

        $repository = $this->createMock(ResourceVisibilityRepositoryInterface::class);
        $repository->method('listExistingPrincipalIdsByResourceAndType')->willReturn([]);
        $repository->method('batchInsertOrIgnore')->willReturn(1);

        $service = new class(...$this->assetAppServiceArgs($domainService, $repository)) extends AssetAppService {
            public function getPrivateFileLinks(string $organizationCode, array $fileLinks): array
            {
                return [
                    'org-a/private/library.png' => new FileLink(
                        'org-a/private/library.png',
                        'https://example.test/org-a/private/library.png',
                        3600,
                    ),
                ];
            }
        };

        $saved = $service->saveToLibrary($authorization, new SaveAssetToLibraryRequestDTO([
            'name' => '库内素材',
            'file_key' => 'org-a/private/library.png',
        ]));

        self::assertSame('https://example.test/org-a/private/library.png', $saved->getFileUrl());
    }

    public function testSaveToLibraryRejectsMissingFileKey(): void
    {
        $authorization = $this->realAssetDataIsolation('org-a', 'user-1');
        $domainService = $this->createMock(AssetDomainService::class);
        $domainService->expects(self::never())->method('saveToLibrary');
        $service = new class(...$this->assetAppServiceArgs($domainService)) extends AssetAppService {
            public function getPrivateFileLinks(string $organizationCode, array $fileLinks): array
            {
                return [];
            }
        };

        try {
            $service->saveToLibrary($authorization, new SaveAssetToLibraryRequestDTO([
                'name' => '不存在的素材',
                'file_key' => 'org-a/private/missing.png',
            ]));
            self::fail('文件不存在时应拒绝保存');
        } catch (BusinessException $exception) {
            self::assertSame(AssetErrorCode::FILE_REQUIRED->value, $exception->getCode());
        }
    }

    /**
     * 批量合规查询只走一次领域批量方法，按入参顺序（含重复）组装，不再逐个 ID 查询。
     */
    public function testBatchComplianceQueriesOnceAndKeepsInputOrder(): void
    {
        $authorization = $this->realAssetDataIsolation('org-a', 'user-1');
        $domainService = $this->createMock(AssetDomainService::class);
        $domainService->expects(self::once())->method('getComplianceStatuses')->with(
            self::isInstanceOf(AssetDataIsolation::class),
            [9, 10, 9],
        )->willReturn([
            '9' => new ProviderAssetEntity(['asset_id' => 9, 'provider_status' => 'PASS']),
            '10' => new ProviderAssetEntity([
                'asset_id' => 10,
                'provider_status' => 'FAILED',
                'provider_failed_reason' => '人像不清晰',
            ]),
        ]);
        // 逐个查询的老路径不能再被调用，否则 N+1 会悄悄回来。
        $domainService->expects(self::never())->method('getComplianceStatus');

        $items = $this->assetService($domainService)->batchCompliance($authorization, [9, 10, 9]);

        self::assertSame([
            ['asset_id' => '9', 'compliance_status' => 'PASS', 'compliance_failed_reason' => null],
            ['asset_id' => '10', 'compliance_status' => 'FAILED', 'compliance_failed_reason' => '人像不清晰'],
            ['asset_id' => '9', 'compliance_status' => 'PASS', 'compliance_failed_reason' => null],
        ], $items);
    }

    /**
     * 素材没有第三方映射时按 UNVERIFIED 返回，与其他接口口径一致。
     */
    public function testBatchComplianceMarksAssetWithoutMappingUnverified(): void
    {
        $authorization = $this->realAssetDataIsolation('org-a', 'user-1');
        $domainService = $this->createMock(AssetDomainService::class);
        $domainService->method('getComplianceStatuses')->willReturn(['9' => null]);

        self::assertSame(
            [['asset_id' => '9', 'compliance_status' => 'UNVERIFIED', 'compliance_failed_reason' => null]],
            $this->assetService($domainService)->batchCompliance($authorization, [9]),
        );
    }

    /**
     * 素材可能已分享给其他用户/部门，删除时必须按资源清空全部主体记录，不能只撤当前用户那一条。
     */
    public function testPersonalAssetDeletionClearsAllVisibilityOfResource(): void
    {
        $authorization = $this->realAssetDataIsolation('org-a', 'user-1');
        $domainService = $this->createMock(AssetDomainService::class);
        $domainService->method('deletePersonal')->willReturn(true);

        $repository = $this->createMock(ResourceVisibilityRepositoryInterface::class);
        $repository->expects(self::never())->method('deleteByResourceAndPrincipals');
        $repository->expects(self::once())->method('deleteByResourceCode')->with(
            self::isInstanceOf(PermissionDataIsolation::class),
            ResourceType::ASSET,
            '9',
        )->willReturn(true);

        self::assertTrue($this->assetService($domainService, $repository)->deletePersonalAsset($authorization, 9));
    }

    public function testBatchPersonalAssetDeletionClearsAllVisibilityOfEachResource(): void
    {
        $authorization = $this->realAssetDataIsolation('org-a', 'user-1');
        $domainService = $this->createMock(AssetDomainService::class);
        $domainService->method('deletePersonalBatch')->willReturn(['9', '10']);

        $cleared = [];
        $repository = $this->createMock(ResourceVisibilityRepositoryInterface::class);
        $repository->expects(self::exactly(2))->method('deleteByResourceCode')
            ->willReturnCallback(static function (...$arguments) use (&$cleared): bool {
                $cleared[] = $arguments[2];
                return true;
            });

        self::assertSame(
            ['9', '10'],
            $this->assetService($domainService, $repository)->batchDeletePersonalAssets($authorization, [9, 10]),
        );
        self::assertSame(['9', '10'], $cleared);
    }

    public function testFailedPersonalAssetDeletionKeepsVisibility(): void
    {
        $authorization = $this->realAssetDataIsolation('org-a', 'user-1');
        $domainService = $this->createMock(AssetDomainService::class);
        $domainService->method('deletePersonal')->willReturn(false);

        // 资产没删掉（不是本人资产或不存在），授权记录必须原样保留。
        $repository = $this->createMock(ResourceVisibilityRepositoryInterface::class);
        $repository->expects(self::never())->method('deleteByResourceCode');

        self::assertFalse($this->assetService($domainService, $repository)->deletePersonalAsset($authorization, 9));
    }

    public function testPublicAssetCreationRegistersOfficialOrganizationVisibility(): void
    {
        $asset = new AssetEntity(['id' => 21, 'organization_code' => 'official-org']);
        $authorization = $this->realAssetDataIsolation('official-org', 'admin-1', true);
        $domainService = $this->createMock(AssetDomainService::class);
        $domainService->method('createPublic')->willReturn($asset);

        $repository = $this->createMock(ResourceVisibilityRepositoryInterface::class);
        $repository->expects(self::once())->method('listExistingPrincipalIdsByResourceAndType')->with(
            self::isInstanceOf(PermissionDataIsolation::class),
            ResourceType::ASSET,
            '21',
            PrincipalType::ORGANIZATION,
            ['official-org'],
        )->willReturn([]);
        $repository->expects(self::once())->method('batchInsertOrIgnore')->willReturn(1);

        $service = $this->adminAssetService($domainService, $repository);
        self::assertSame($asset, $service->createPublicAsset(
            $authorization,
            new CreateAssetRequestDTO(['asset_kind' => 'ASSET']),
        ));
    }

    public function testPublicAssetDeletionClearsAllVisibilityOfResource(): void
    {
        $authorization = $this->realAssetDataIsolation('official-org', 'admin-1', true);
        $domainService = $this->createMock(AssetDomainService::class);
        $domainService->method('deletePublic')->willReturn(true);

        $repository = $this->createMock(ResourceVisibilityRepositoryInterface::class);
        $repository->expects(self::never())->method('deleteByResourceAndPrincipals');
        $repository->expects(self::once())->method('deleteByResourceCode')->with(
            self::isInstanceOf(PermissionDataIsolation::class),
            ResourceType::ASSET,
            '21',
        )->willReturn(true);

        self::assertTrue($this->adminAssetService($domainService, $repository)->deletePublicAsset($authorization, 21));
    }

    public function testShelvedPublicAssetRevokesVisibility(): void
    {
        $asset = new AssetEntity(['id' => 21, 'organization_code' => 'official-org', 'user_id' => null]);
        $authorization = $this->realAssetDataIsolation('official-org', 'admin-1', true);
        $domainService = $this->createMock(AssetDomainService::class);
        $domainService->method('findPublic')->willReturn($asset);
        $domainService->method('updatePublic')->willReturnCallback(
            static fn (AssetDataIsolation $dataIsolation, AssetEntity $updated): AssetEntity => $updated,
        );

        $repository = $this->createMock(ResourceVisibilityRepositoryInterface::class);
        $repository->expects(self::once())->method('deleteByResourceAndPrincipals')->with(
            self::isInstanceOf(PermissionDataIsolation::class),
            ResourceType::ASSET,
            '21',
            PrincipalType::ORGANIZATION,
            ['official-org'],
        )->willReturn(1);
        $repository->expects(self::never())->method('batchInsertOrIgnore');

        $service = $this->adminAssetService($domainService, $repository);
        self::assertNotNull($service->updatePublicAsset($authorization, 21, new UpdateAssetRequestDTO(['status' => 0])));
        self::assertFalse($asset->getStatus()->isEnabled());
    }

    public function testRestoredPublicAssetGrantsVisibilityAgain(): void
    {
        $asset = new AssetEntity(['id' => 21, 'organization_code' => 'official-org', 'status' => 0]);
        $authorization = $this->realAssetDataIsolation('official-org', 'admin-1', true);
        $domainService = $this->createMock(AssetDomainService::class);
        $domainService->method('findPublic')->willReturn($asset);
        $domainService->method('updatePublic')->willReturnCallback(
            static fn (AssetDataIsolation $dataIsolation, AssetEntity $updated): AssetEntity => $updated,
        );

        $repository = $this->createMock(ResourceVisibilityRepositoryInterface::class);
        $repository->expects(self::once())->method('listExistingPrincipalIdsByResourceAndType')->with(
            self::isInstanceOf(PermissionDataIsolation::class),
            ResourceType::ASSET,
            '21',
            PrincipalType::ORGANIZATION,
            ['official-org'],
        )->willReturn([]);
        $repository->expects(self::once())->method('batchInsertOrIgnore')->willReturn(1);
        $repository->expects(self::never())->method('deleteByResourceAndPrincipals');

        $service = $this->adminAssetService($domainService, $repository);
        self::assertNotNull($service->updatePublicAsset($authorization, 21, new UpdateAssetRequestDTO(['status' => 1])));
        self::assertTrue($asset->getStatus()->isEnabled());
    }

    public function testPublicAssetUpdateResolvesPrivateFileUrl(): void
    {
        $asset = new AssetEntity([
            'id' => 21,
            'organization_code' => 'official-org',
            'user_id' => null,
            'file_key' => 'official-org/private/image.png',
            'status' => 0,
        ]);
        $authorization = $this->realAssetDataIsolation('official-org', 'admin-1', true);
        $domainService = $this->createMock(AssetDomainService::class);
        $domainService->method('findPublic')->willReturn($asset);
        $domainService->method('updatePublic')->willReturn($asset);

        $repository = $this->createMock(ResourceVisibilityRepositoryInterface::class);
        $repository->expects(self::once())->method('deleteByResourceAndPrincipals')->willReturn(1);
        $service = new class(...$this->adminAssetAppServiceArgs($domainService, $repository)) extends AdminAssetAppService {
            public function getPrivateFileLinks(string $organizationCode, array $fileLinks): array
            {
                return [
                    'official-org/private/image.png' => new FileLink(
                        'official-org/private/image.png',
                        'https://example.test/official-org/private/image.png',
                        3600,
                    ),
                ];
            }
        };

        $updated = $service->updatePublicAsset($authorization, 21, new UpdateAssetRequestDTO());
        self::assertSame('https://example.test/official-org/private/image.png', $updated?->getFileUrl());
    }

    /**
     * 记录仓储收到的查询条件，用于断言列表范围与授权资产主键。
     */
    private function collectQueries(AssetDomainService $domainService): object
    {
        $collector = new class {
            /** @var array<int, array{0: AssetScope, 1: array<string>}> */
            public array $scopes = [];
        };
        $domainService->method('queries')->willReturnCallback(
            static function (AssetDataIsolation $dataIsolation, AssetQuery $query, Page $page) use ($collector): array {
                $collector->scopes[] = [$query->getScope(), $query->getSharedAssetIds()];
                return ['total' => 0, 'list' => []];
            }
        );
        return $collector;
    }

    /**
     * ResourceVisibilityDomainService 是 readonly class，PHPUnit 无法 createMock，
     * 这里用真实实例 + mock 仓储来驱动，写入路径都是接口调用、不落 Db::transaction。
     */
    private function visibilityDomainService(?ResourceVisibilityRepositoryInterface $repository = null): ResourceVisibilityDomainService
    {
        return new ResourceVisibilityDomainService(
            $repository ?? $this->createMock(ResourceVisibilityRepositoryInterface::class),
            $this->createMock(MagicDepartmentUserRepositoryInterface::class),
        );
    }

    /**
     * AssetAppService 的构造参数（7 个）。
     *
     * @return array<int, mixed>
     */
    private function assetAppServiceArgs(
        AssetDomainService $domainService,
        ?ResourceVisibilityRepositoryInterface $repository = null,
        ?AssetTagDomainService $tagDomainService = null,
    ): array {
        return [
            $domainService,
            $this->visibilityDomainService($repository),
            $this->projectFileMaterializer(),
            $tagDomainService ?? $this->createMock(AssetTagDomainService::class),
            $this->createMock(MagicUserDomainService::class),
            new NullLogger(),
            $this->createMock(AssetVisualPrecheck::class),
        ];
    }

    /**
     * AdminAssetAppService 的构造参数（3 个）。
     *
     * @return array<int, mixed>
     */
    private function adminAssetAppServiceArgs(
        AssetDomainService $domainService,
        ?ResourceVisibilityRepositoryInterface $repository = null,
    ): array {
        return [
            $domainService,
            $this->visibilityDomainService($repository),
            $this->createMock(AssetTagDomainService::class),
        ];
    }

    /**
     * 无可见性断言的用例用它拼服务，避免每个构造点都写一遍 mock 仓储。
     */
    private function assetService(
        AssetDomainService $domainService,
        ?ResourceVisibilityRepositoryInterface $repository = null,
        ?AssetTagDomainService $tagDomainService = null,
    ): AssetAppService {
        return new class(...$this->assetAppServiceArgs($domainService, $repository, $tagDomainService)) extends AssetAppService {
            public function getPrivateFileLinks(string $organizationCode, array $fileLinks): array
            {
                return array_fill_keys($fileLinks, new FileLink('', 'https://example.test/asset', 3600));
            }
        };
    }

    private function projectFileMaterializer(): ProjectFileMaterializer
    {
        return $this->createMock(ProjectFileMaterializer::class);
    }

    private function adminAssetService(
        AssetDomainService $domainService,
        ?ResourceVisibilityRepositoryInterface $repository = null,
    ): AdminAssetAppService {
        return new class(...$this->adminAssetAppServiceArgs($domainService, $repository)) extends AdminAssetAppService {
            public function getPrivateFileLinks(string $organizationCode, array $fileLinks): array
            {
                return [];
            }
        };
    }

    /**
     * 可见性写入会把 AssetDataIsolation 转成 PermissionDataIsolation，
     * 转换过程要求第三方隔离管理器是真实实现（mock 出来的桩缺少企业方法），所以这里用真实对象。
     */
    private function realAssetDataIsolation(string $organizationCode, string $userId, bool $official = false): AssetDataIsolation
    {
        $isolation = new AssetDataIsolation($organizationCode, $userId);
        if ($official) {
            $isolation->setOfficialOrganizationCodes([$organizationCode]);
        }
        return $isolation;
    }
}

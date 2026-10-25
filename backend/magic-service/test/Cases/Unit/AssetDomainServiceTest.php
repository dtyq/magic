<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit;

use App\Application\Asset\Service\AdminAssetAppService;
use App\Domain\Asset\Contract\AssetProviderInterface;
use App\Domain\Asset\Entity\AssetDataIsolation;
use App\Domain\Asset\Entity\AssetEntity;
use App\Domain\Asset\Entity\AssetTagEntity;
use App\Domain\Asset\Entity\ProviderAssetEntity;
use App\Domain\Asset\Entity\ValueObject\ProviderAssetStatus;
use App\Domain\Asset\Entity\ValueObject\ProviderReviewMode;
use App\Domain\Asset\Entity\ValueObject\Query\AssetQuery;
use App\Domain\Asset\Repository\Facade\AssetAgreementRepositoryInterface;
use App\Domain\Asset\Repository\Facade\AssetProviderAssetRepositoryInterface;
use App\Domain\Asset\Repository\Facade\AssetRepositoryInterface;
use App\Domain\Asset\Repository\Persistence\Model\AssetModel;
use App\Domain\Asset\Repository\Persistence\Model\AssetProviderAssetModel;
use App\Domain\Asset\Service\AssetDomainService;
use App\Domain\Asset\Service\AssetSearchTextBuilder;
use App\Domain\Asset\Service\AssetTagDomainService;
use App\Domain\Contact\Repository\Facade\MagicDepartmentUserRepositoryInterface;
use App\Domain\Permission\Repository\Facade\ResourceVisibilityRepositoryInterface;
use App\Domain\Permission\Service\ResourceVisibilityDomainService;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\ErrorCode\AssetErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Asset\Assembler\AssetAssembler;
use App\Interfaces\Asset\DTO\Request\CreateAssetRequestDTO;
use Hyperf\Context\ApplicationContext;
use Hyperf\Context\Context;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\AbstractLogger;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;
use ReflectionMethod;
use ReflectionParameter;
use RuntimeException;

/**
 * @internal
 */
final class AssetDomainServiceTest extends TestCase
{
    private ?ContainerInterface $containerBeforeTest = null;

    protected function setUp(): void
    {
        parent::setUp();
        // 裸 PHPUnit 跑在 Swow 主协程里，Context 是进程级共享，需清掉上一个用例残留的缓存。
        Context::destroy(AssetDomainService::PROVIDER_CONTEXT_KEY);
        if (ApplicationContext::hasContainer()) {
            $this->containerBeforeTest = ApplicationContext::getContainer();
        }
        ApplicationContext::setContainer(new class implements ContainerInterface {
            public function get(string $id): object
            {
                if ($id === TranslatorInterface::class) {
                    return new class implements TranslatorInterface {
                        public function trans(string $key, array $replace = [], ?string $locale = null): string
                        {
                            return $key;
                        }

                        public function transChoice(string $key, mixed $number, array $replace = [], ?string $locale = null): string
                        {
                            return $key;
                        }

                        public function getLocale(): string
                        {
                            return 'zh_CN';
                        }

                        public function setLocale(string $locale): void
                        {
                        }
                    };
                }
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
                if ($id === EventDispatcherInterface::class) {
                    // Hyperf 模型在构造时会 boot 事件，需要容器给出事件派发器。
                    return new class implements EventDispatcherInterface {
                        public function dispatch(object $event): object
                        {
                            return $event;
                        }
                    };
                }
                return new class {};
            }

            public function has(string $id): bool
            {
                return in_array($id, [ConfigInterface::class, TranslatorInterface::class, EventDispatcherInterface::class], true);
            }
        });
    }

    protected function tearDown(): void
    {
        if ($this->containerBeforeTest !== null) {
            ApplicationContext::setContainer($this->containerBeforeTest);
        }
        parent::tearDown();
    }

    public function testQueriesReturnEntitiesThatCanBeAssembled(): void
    {
        $model = $this->assetModel(['id' => 1, 'organization_code' => 'org-a', 'user_id' => 'user-a']);
        $repository = $this->createMock(AssetRepositoryInterface::class);
        $repository->expects(self::once())->method('queries')->willReturn([
            'total' => 1,
            'list' => [new AssetEntity($model->toArray())],
        ]);

        $result = $this->domainService($repository)->queries(
            $this->dataIsolation('org-a', 'user-a', ['org-a']),
            new AssetQuery(),
            new Page(1, 10),
        );

        self::assertInstanceOf(AssetEntity::class, $result['list'][0]);
        $response = AssetAssembler::createList($result['list'], new Page(1, 10), 1)->toArray();
        self::assertCount(1, $response['list']);
    }

    public function testAssetEntityContainsOnlyMagicAssetsFields(): void
    {
        $asset = new AssetEntity([
            'file_key' => 'asset.png',
            'agreement_version' => '1.0',
            'provider_asset_id' => 'provider-1',
        ]);

        self::assertArrayNotHasKey('agreement_version', $asset->toArray());
        self::assertArrayNotHasKey('provider_asset_id', $asset->toArray());
        self::assertArrayNotHasKey('provider_group_id', $asset->toArray());
        self::assertArrayNotHasKey('provider_status', $asset->toArray());
    }

    public function testLocalSaveOnlyTakesIsolationAndAsset(): void
    {
        $method = new ReflectionMethod(AssetDomainService::class, 'saveLocal');
        $names = array_map(
            static fn (ReflectionParameter $parameter): string => $parameter->getName(),
            $method->getParameters(),
        );

        // 落库阶段不接收第三方映射：映射在同步阶段拿到凭证后各自写入，资产主表不感知第三方生命周期。
        self::assertSame(['dataIsolation', 'asset'], $names);
    }

    public function testOfficialAssetDetailIsReadableWithoutUserOwnerFilter(): void
    {
        $model = $this->assetModel([
            'id' => 2,
            'organization_code' => 'official',
            'user_id' => null,
            'status' => 1,
        ]);
        $repository = $this->createMock(AssetRepositoryInterface::class);
        $repository->expects(self::once())
            ->method('findById')
            ->with(self::isInstanceOf(AssetDataIsolation::class), 2)
            ->willReturn(new AssetEntity($model->toArray()));

        $result = $this->domainService($repository)->find(
            $this->dataIsolation('org-a', 'user-a', ['org-a', 'official']),
            2,
        );

        self::assertInstanceOf(AssetEntity::class, $result);
        self::assertSame('official', $result->getOrganizationCode());
    }

    public function testAssetWithFailedComplianceIsStillReadableForOwner(): void
    {
        $model = $this->assetModel(['id' => 5]);
        $repository = $this->createMock(AssetRepositoryInterface::class);
        $repository->method('findById')->willReturn(new AssetEntity($model->toArray()));

        // 列表不再按第三方状态过滤，详情同步放开，否则列表可见但点不开；
        // 校验状态与失败原因由响应层的 compliance_status / compliance_failed_reason 表达。
        $asset = $this->domainService($repository)->find(
            $this->dataIsolation('org-a', 'user-a', ['org-a', 'official']),
            5,
        );
        self::assertNotNull($asset);
        self::assertSame(5, $asset->getId());
    }

    public function testOtherUsersPersonalAssetIsNotReadable(): void
    {
        $model = $this->assetModel([
            'id' => 4,
            'organization_code' => 'org-a',
            'user_id' => 'user-b',
        ]);
        $repository = $this->createMock(AssetRepositoryInterface::class);
        $repository->method('findById')->willReturn(new AssetEntity($model->toArray()));

        self::assertNull($this->domainService($repository)->find(
            $this->dataIsolation('org-a', 'user-a', ['org-a', 'official']),
            4,
        ));
    }

    public function testGrantedSharedAssetDetailIsReadable(): void
    {
        $model = $this->assetModel([
            'id' => 4,
            'organization_code' => 'org-a',
            'user_id' => 'user-b',
        ]);
        $repository = $this->createMock(AssetRepositoryInterface::class);
        $repository->method('findById')->willReturn(new AssetEntity($model->toArray()));

        // 可见范围已确认当前用户在授权列表里（团队分享），别人的个人素材同样可以看详情。
        $result = $this->domainService($repository)->find(
            $this->dataIsolation('org-a', 'user-a', ['org-a', 'official']),
            4,
            true,
        );

        self::assertInstanceOf(AssetEntity::class, $result);
        self::assertSame('user-b', $result->getUserId());
    }

    public function testDisabledOfficialAssetIsNotReadable(): void
    {
        $model = $this->assetModel([
            'id' => 5,
            'organization_code' => 'official',
            'user_id' => null,
            'status' => 0,
        ]);
        $repository = $this->createMock(AssetRepositoryInterface::class);
        $repository->method('findById')->willReturn(new AssetEntity($model->toArray()));

        self::assertNull($this->domainService($repository)->find(
            $this->dataIsolation('org-a', 'user-a', ['org-a', 'official']),
            5,
        ));
    }

    public function testPublicDeleteDoesNotFilterByAdministratorUserId(): void
    {
        $repository = $this->createMock(AssetRepositoryInterface::class);
        $repository->expects(self::once())->method('findById')->with(
            self::isInstanceOf(AssetDataIsolation::class),
            3,
        )->willReturn(new AssetEntity($this->assetModel([
            'id' => 3,
            'organization_code' => 'official',
            'user_id' => null,
        ])->toArray()));
        $repository->expects(self::once())
            ->method('delete')
            ->with(
                self::isInstanceOf(AssetDataIsolation::class),
                self::callback(static fn (AssetEntity $asset): bool => $asset->getId() === 3),
            )
            ->willReturn(true);
        // 官方组织下的公开资产没有第三方映射，删除只走本地。
        $service = $this->domainService($repository);

        self::assertTrue($service->deletePublic(
            $this->dataIsolation('official', 'admin-a', ['official']),
            3,
        ));
    }

    public function testPublicUpdateDoesNotModifyPersonalAsset(): void
    {
        $repository = $this->createMock(AssetRepositoryInterface::class);
        $repository->expects(self::once())->method('findById')->with(
            self::isInstanceOf(AssetDataIsolation::class),
            7,
        )->willReturn(new AssetEntity($this->assetModel([
            'id' => 7,
            'organization_code' => 'official',
            'user_id' => 'user-a',
        ])->toArray()));
        $repository->expects(self::never())->method('update');
        $service = $this->domainService($repository);

        self::assertNull($service->updatePublic(
            $this->dataIsolation('official', 'admin-a', ['official']),
            new AssetEntity(['id' => 7, 'name_i18n' => ['default' => 'updated']]),
        ));
    }

    public function testAdminAssetManagementRequiresOfficialOrganization(): void
    {
        $domainService = $this->createMock(AssetDomainService::class);
        $domainService->expects(self::never())->method('createPublic');
        $request = $this->createMock(CreateAssetRequestDTO::class);
        $service = new AdminAssetAppService(
            $domainService,
            $this->visibilityDomainService(),
            $this->createMock(AssetTagDomainService::class),
        );

        $this->expectException(BusinessException::class);
        $service->createPublicAsset(
            $this->dataIsolation('org-a', 'admin-a', ['org-a']),
            $request,
        );
    }

    /**
     * 批量合规查询一次取回素材和映射，查询次数不随 ID 增长；无映射的素材返回 null（UNVERIFIED）。
     */
    public function testBatchComplianceStatusesLoadsAssetsAndMappingsOnce(): void
    {
        $this->primeProviderContext();

        $repository = $this->createMock(AssetRepositoryInterface::class);
        $repository->expects(self::once())->method('findByIds')->with(
            self::isInstanceOf(AssetDataIsolation::class),
            ['9', '10'],
        )->willReturn([
            new AssetEntity($this->assetModel(['id' => 9])->toArray()),
            new AssetEntity($this->assetModel(['id' => 10])->toArray()),
        ]);
        // 逐个查询的老路径不能再被调用，否则批量接口又退化成 N+1。
        $repository->expects(self::never())->method('findById');

        $mapping = $this->createMock(AssetProviderAssetModel::class);
        $mapping->method('toArray')->willReturn([
            'asset_id' => 9,
            'provider_code' => 'VolcengineArk',
            'project_name' => 'default',
            'provider_status' => 'PASS',
            'provider_failed_reason' => null,
        ]);

        $providerAssets = $this->createMock(AssetProviderAssetRepositoryInterface::class);
        $providerAssets->expects(self::once())->method('findMappingModels')->with(
            self::isInstanceOf(AssetDataIsolation::class),
            ['9', '10'],
            'VolcengineArk',
        )->willReturn(['9' => $mapping]);
        $providerAssets->expects(self::never())->method('findMapping');

        $statuses = $this->domainService($repository, $providerAssets)->getComplianceStatuses(
            $this->dataIsolation('org-a', 'user-a', ['org-a']),
            [9, 10],
        );

        self::assertSame(ProviderAssetStatus::PASS, $statuses['9']->getProviderStatus());
        self::assertNull($statuses['10']);
    }

    /**
     * 批量同样逐个校验归属：混入别人的素材必须抛 NOT_FOUND，不能因为批量而放宽。
     */
    public function testBatchComplianceStatusesRejectsAssetOwnedByAnotherUser(): void
    {
        $this->primeProviderContext();

        $repository = $this->createMock(AssetRepositoryInterface::class);
        $repository->method('findByIds')->willReturn([
            new AssetEntity($this->assetModel(['id' => 11, 'user_id' => 'user-b'])->toArray()),
        ]);

        $providerAssets = $this->createMock(AssetProviderAssetRepositoryInterface::class);
        $providerAssets->expects(self::never())->method('findMappingModels');

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(AssetErrorCode::NOT_FOUND->value);
        $this->domainService($repository, $providerAssets)->getComplianceStatuses(
            $this->dataIsolation('org-a', 'user-a', ['org-a']),
            [11],
        );
    }

    /**
     * 超时判定用批量查回来的映射行，回写时不再按 ID 重查一次映射。
     */
    public function testBatchComplianceTimeoutMarksFailedWithLoadedMapping(): void
    {
        $this->primeProviderContext();

        $repository = $this->createMock(AssetRepositoryInterface::class);
        $repository->method('findByIds')->willReturn([
            new AssetEntity($this->assetModel(['id' => 12])->toArray()),
        ]);

        $mapping = $this->createMock(AssetProviderAssetModel::class);
        $mapping->method('toArray')->willReturn([
            'asset_id' => 12,
            'provider_code' => 'VolcengineArk',
            'project_name' => 'default',
            'provider_status' => 'PROCESSING',
            'provider_failed_reason' => null,
        ]);
        // 映射行的 updated_at 远期，触发合规超时。
        $mapping->method('__get')->willReturnCallback(
            static fn (string $key): ?string => $key === 'updated_at' ? '2020-01-01 00:00:00' : null,
        );

        $saved = [];
        $providerAssets = $this->createMock(AssetProviderAssetRepositoryInterface::class);
        $providerAssets->method('findMappingModels')->willReturn(['12' => $mapping]);
        $providerAssets->expects(self::never())->method('findMapping');
        $providerAssets->expects(self::once())->method('saveMapping')->willReturnCallback(
            function (AssetDataIsolation $isolation, ProviderAssetEntity $entity) use (&$saved): AssetProviderAssetModel {
                $saved[] = $entity->getProviderStatus();
                return $this->createMock(AssetProviderAssetModel::class);
            }
        );

        $statuses = $this->domainService($repository, $providerAssets)->getComplianceStatuses(
            $this->dataIsolation('org-a', 'user-a', ['org-a']),
            [12],
        );

        self::assertSame([ProviderAssetStatus::FAILED], $saved);
        self::assertSame(ProviderAssetStatus::FAILED, $statuses['12']->getProviderStatus());
    }

    /**
     * 单条与批量共用同一实现，避免两套逻辑漂移。
     */
    public function testSingleComplianceStatusDelegatesToBatch(): void
    {
        $this->primeProviderContext();

        $repository = $this->createMock(AssetRepositoryInterface::class);
        $repository->expects(self::once())->method('findByIds')->willReturn([
            new AssetEntity($this->assetModel(['id' => 13])->toArray()),
        ]);
        $repository->expects(self::never())->method('findById');

        $providerAssets = $this->createMock(AssetProviderAssetRepositoryInterface::class);
        $providerAssets->method('findMappingModels')->willReturn([]);

        self::assertNull($this->domainService($repository, $providerAssets)->getComplianceStatus(
            $this->dataIsolation('org-a', 'user-a', ['org-a']),
            13,
        ));
    }

    public function testComplianceTimeoutMarksProviderMappingFailedWithoutRecycling(): void
    {
        $logger = $this->collectingLogger();
        $provider = $this->createMock(AssetProviderInterface::class);
        $provider->method('getProviderCode')->willReturn('ark');
        $provider->expects(self::once())
            ->method('createAssetGroup')
            ->willReturn(['provider_group_id' => 'group-timeout']);
        $provider->expects(self::once())
            ->method('createAsset')
            ->willReturn(['provider_asset_id' => 'asset-timeout', 'provider_status' => 'PROCESSING']);
        // 回查始终没有终态，直到触到上限。
        $provider->method('getAssetStatus')->willReturn([
            'provider_asset_id' => 'asset-timeout',
            'provider_status' => 'PROCESSING',
        ]);
        // 超时不回收：素材可能仍在第三方审核，删掉会打断审核流程。
        $provider->expects(self::never())->method('deleteAsset');
        $provider->expects(self::never())->method('deleteAssetGroup');

        $statuses = [];
        $providerAssets = $this->createMock(AssetProviderAssetRepositoryInterface::class);
        $providerAssets->method('findMapping')->willReturn(null);
        $providerAssets->method('saveMapping')->willReturnCallback(
            function (AssetDataIsolation $isolation, ProviderAssetEntity $mapping) use (&$statuses): AssetProviderAssetModel {
                $statuses[] = $mapping->getProviderStatus();
                return $this->createMock(AssetProviderAssetModel::class);
            }
        );

        try {
            $this->serviceWithFakedPolling($this->savingAssets(51), $provider, $providerAssets, $logger, 1)->createPublic(
                $this->dataIsolation('official', 'user-a', ['official']),
                new AssetEntity(['file_key' => 'asset.png']),
            );
            self::fail('合规回查超时必须向上抛出');
        } catch (BusinessException $exception) {
            // 超时是独立的业务错误码：调用方要能把它和「第三方给了否定结论」区分开。
            self::assertSame(AssetErrorCode::COMPLIANCE_TIMEOUT->value, $exception->getCode());
        }

        // 先落库、再同步、失败只回写映射状态：本地资产不被回滚删除，远程资源也不回收。
        self::assertSame(ProviderAssetStatus::PROCESSING, $statuses[0]);
        self::assertSame(ProviderAssetStatus::FAILED, end($statuses));
        self::assertNotNull($this->findLogRecord($logger, '第三方素材合规回查超时'));
    }

    public function testPersonalAssetCreationRequiresAcceptedAgreement(): void
    {
        $agreement = $this->createMock(AssetAgreementRepositoryInterface::class);
        $agreement->expects(self::once())->method('hasAccepted')->willReturn(false);
        $provider = $this->createMock(AssetProviderInterface::class);
        $provider->expects(self::never())->method('createAsset');
        $providerAssets = $this->createMock(AssetProviderAssetRepositoryInterface::class);
        $providerAssets->expects(self::never())->method('saveMapping');

        $service = $this->domainService(
            $this->createMock(AssetRepositoryInterface::class),
            $providerAssets,
            $provider,
            $agreement,
        );

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(AssetErrorCode::AGREEMENT_REQUIRED->value);
        $service->createPersonal(
            $this->dataIsolation('org-a', 'user-a', ['org-a']),
            new AssetEntity(['file_key' => 'asset.png']),
        );
    }

    public function testSaveToLibrarySkipsProviderEntirely(): void
    {
        $persisted = null;
        $assets = $this->createMock(AssetRepositoryInterface::class);
        $assets->expects(self::once())->method('save')->willReturnCallback(
            static function (AssetDataIsolation $isolation, AssetEntity $asset) use (&$persisted): AssetEntity {
                $persisted = $asset;
                return $asset;
            }
        );
        // 保存到素材库不碰第三方：不建组、不建素材、不写映射，也不要求先签素材协议。
        $provider = $this->createMock(AssetProviderInterface::class);
        $provider->expects(self::never())->method('createAsset');
        $provider->expects(self::never())->method('createAssetGroup');
        $agreement = $this->createMock(AssetAgreementRepositoryInterface::class);
        $agreement->expects(self::never())->method('hasAccepted');
        $providerAssets = $this->createMock(AssetProviderAssetRepositoryInterface::class);
        $providerAssets->expects(self::never())->method('saveMapping');

        $result = $this->domainService($assets, $providerAssets, $provider, $agreement)->saveToLibrary(
            $this->dataIsolation('org-a', 'user-a', ['org-a']),
            new AssetEntity(['file_key' => 'a.png']),
        );

        self::assertSame('user-a', $result->getUserId());
        self::assertSame('org-a', $result->getOrganizationCode());
        self::assertNotNull($persisted);
    }

    public function testSigningAlreadyAcceptedAgreementIsIdempotent(): void
    {
        $agreement = $this->createMock(AssetAgreementRepositoryInterface::class);
        $agreement->expects(self::once())->method('hasAccepted')->willReturn(true);
        $agreement->expects(self::never())->method('markAccepted');

        $service = $this->domainService($this->createMock(AssetRepositoryInterface::class), null, null, $agreement);

        $service->signAgreement($this->dataIsolation('org-a', 'user-a', ['org-a']));
    }

    public function testAssetIsPersistedBeforeCallingProvider(): void
    {
        $calls = [];
        $assets = $this->createMock(AssetRepositoryInterface::class);
        $assets->expects(self::once())->method('save')->willReturnCallback(
            static function (AssetDataIsolation $isolation, AssetEntity $asset) use (&$calls): AssetEntity {
                $calls[] = 'save';
                $asset->setId(61);
                return $asset;
            }
        );

        $provider = $this->createMock(AssetProviderInterface::class);
        $provider->method('getProviderCode')->willReturn('ark');
        $provider->method('extractComplianceFailedReason')
            ->willReturn('第三方素材合规校验未通过（provider_status=FAILED）');
        $provider->expects(self::once())->method('createAssetGroup')->willReturnCallback(
            function () use (&$calls): array {
                $calls[] = 'createAssetGroup';
                return ['provider_group_id' => 'group-61'];
            }
        );
        $provider->expects(self::once())->method('createAsset')->willReturnCallback(
            function () use (&$calls): array {
                $calls[] = 'createAsset';
                return ['provider_asset_id' => 'asset-61', 'provider_status' => 'PASS'];
            }
        );

        $providerAssets = $this->createMock(AssetProviderAssetRepositoryInterface::class);
        $providerAssets->method('findMapping')->willReturn(null);
        $providerAssets->method('saveMapping')->willReturn($this->createMock(AssetProviderAssetModel::class));

        $this->serviceWithFakedPolling($assets, $provider, $providerAssets)->createPublic(
            $this->dataIsolation('org-a', 'user-a', ['org-a']),
            new AssetEntity(['file_key' => 'a.png']),
        );

        // 本地落库必须早于任何第三方调用：这是「远程已建、本地没落」窗口消失的前提。
        $saveAt = array_search('save', $calls, true);
        $groupAt = array_search('createAssetGroup', $calls, true);
        $assetAt = array_search('createAsset', $calls, true);
        self::assertIsInt($saveAt);
        self::assertIsInt($groupAt);
        self::assertIsInt($assetAt);
        self::assertTrue($saveAt < $groupAt, '本地落库必须早于第三方建组');
        self::assertTrue($groupAt < $assetAt, '素材必须在素材组之后创建');
    }

    public function testProviderGroupCredentialIsPersistedBeforeAssetCreation(): void
    {
        $providerCalls = [];
        $provider = $this->createMock(AssetProviderInterface::class);
        $provider->method('getProviderCode')->willReturn('ark');
        $provider->expects(self::once())
            ->method('createAssetGroup')
            ->willReturnCallback(function () use (&$providerCalls): array {
                $providerCalls[] = 'createAssetGroup';
                return ['provider_group_id' => 'group-71'];
            });
        $provider->expects(self::once())
            ->method('createAsset')
            ->willReturnCallback(function () use (&$providerCalls): array {
                $providerCalls[] = 'createAsset';
                return ['provider_asset_id' => 'asset-71', 'provider_status' => 'PASS'];
            });

        $writes = [];
        $providerAssets = $this->createMock(AssetProviderAssetRepositoryInterface::class);
        $providerAssets->method('findMapping')->willReturn(null);
        // 三行都落在素材自己的 asset_id 上：先立起处理中的映射，再补组凭证，最后由素材凭证补齐。
        $providerAssets->expects(self::exactly(3))->method('saveMapping')->willReturnCallback(
            function (AssetDataIsolation $isolation, ProviderAssetEntity $mapping) use (&$writes): AssetProviderAssetModel {
                $writes[] = [
                    $mapping->getAssetId(),
                    $mapping->getProviderAssetId(),
                    $mapping->getProviderGroupId(),
                    $mapping->getProviderStatus()->value,
                ];
                return $this->createMock(AssetProviderAssetModel::class);
            }
        );

        $this->serviceWithFakedPolling($this->savingAssets(71), $provider, $providerAssets)->createPublic(
            $this->dataIsolation('org-a', 'user-a', ['org-a']),
            new AssetEntity(['file_key' => 'a.png']),
        );

        self::assertSame(['createAssetGroup', 'createAsset'], $providerCalls);
        // 组凭证必须在素材创建之前落库，否则中途失败就再也追不回这个组。
        self::assertSame([
            [71, '', null, 'PROCESSING'],
            [71, '', 'group-71', 'PROCESSING'],
            [71, 'asset-71', 'group-71', 'PASS'],
        ], $writes);
    }

    public function testAssetGroupCredentialPersistFailureMarksProviderMappingFailed(): void
    {
        $statuses = [];
        $providerAssets = $this->createMock(AssetProviderAssetRepositoryInterface::class);
        $providerAssets->method('findMapping')->willReturn(null);
        $providerAssets->expects(self::exactly(3))->method('saveMapping')->willReturnCallback(
            function (AssetDataIsolation $isolation, ProviderAssetEntity $mapping) use (&$statuses): AssetProviderAssetModel {
                $statuses[] = $mapping->getProviderStatus();
                if (count($statuses) === 2) {
                    // 第二次写入是素材组凭证：这一行没落库，远程建好的组就失去了本地依据。
                    throw new RuntimeException('映射表不可用');
                }
                return $this->createMock(AssetProviderAssetModel::class);
            }
        );

        $provider = $this->createMock(AssetProviderInterface::class);
        $provider->method('getProviderCode')->willReturn('ark');
        $provider->expects(self::once())
            ->method('createAssetGroup')
            ->willReturn(['provider_group_id' => 'group-99']);
        // 素材不会在组凭证缺失的情况下继续创建。
        $provider->expects(self::never())->method('createAsset');
        // 凭证没写进去也不回收：远程建出来的组已经没有本地记录可依据，删与不删都是风险，交给人工。
        $provider->expects(self::never())->method('deleteAsset');
        $provider->expects(self::never())->method('deleteAssetGroup');

        try {
            $this->serviceWithFakedPolling($this->savingAssets(81), $provider, $providerAssets)->createPublic(
                $this->dataIsolation('org-a', 'user-a', ['org-a']),
                new AssetEntity(['file_key' => 'a.png']),
            );
            self::fail('素材组凭证写入失败必须向上抛出');
        } catch (RuntimeException $exception) {
            self::assertSame('映射表不可用', $exception->getMessage());
        }

        // 本地资产保留并标记失败：状态写在映射表上，用户看不到通过，失败原因可查。
        self::assertSame(ProviderAssetStatus::FAILED, end($statuses));
    }

    public function testProviderAssetResponseWithoutIdMarksProviderMappingFailed(): void
    {
        $statuses = [];
        $providerAssets = $this->createMock(AssetProviderAssetRepositoryInterface::class);
        $providerAssets->method('findMapping')->willReturn(null);
        $providerAssets->expects(self::exactly(3))->method('saveMapping')->willReturnCallback(
            function (AssetDataIsolation $isolation, ProviderAssetEntity $mapping) use (&$statuses): AssetProviderAssetModel {
                $statuses[] = $mapping->getProviderStatus();
                return $this->createMock(AssetProviderAssetModel::class);
            }
        );

        $provider = $this->createMock(AssetProviderInterface::class);
        $provider->method('getProviderCode')->willReturn('ark');
        $provider->expects(self::once())
            ->method('createAssetGroup')
            ->willReturn(['provider_group_id' => 'group-orphan']);
        // 响应里没有素材 ID，无从登记映射。
        $provider->expects(self::once())
            ->method('createAsset')
            ->willReturn(['provider_status' => 'PASS']);

        try {
            $this->serviceWithFakedPolling($this->savingAssets(82), $provider, $providerAssets)->createPublic(
                $this->dataIsolation('org-a', 'user-a', ['org-a']),
                new AssetEntity(['file_key' => 'a.png']),
            );
            self::fail('第三方没有返回素材 ID 时必须抛出 PROVIDER_RESPONSE_INVALID');
        } catch (BusinessException $exception) {
            self::assertSame(AssetErrorCode::PROVIDER_RESPONSE_INVALID->value, $exception->getCode());
        }

        self::assertSame(ProviderAssetStatus::FAILED, end($statuses));
    }

    public function testUnverifiableProviderStatusKeepsPollingUntilTimeout(): void
    {
        $logger = $this->collectingLogger();
        $provider = $this->createMock(AssetProviderInterface::class);
        $provider->method('getProviderCode')->willReturn('ark');
        $provider->expects(self::once())
            ->method('createAssetGroup')
            ->willReturn(['provider_group_id' => 'group-default']);
        $provider->expects(self::once())
            ->method('createAsset')
            ->willReturn(['provider_asset_id' => 'asset-unknown', 'provider_status' => 'PROCESSING']);
        // 回查本身也抛异常：应当继续等，而不是把这条资产判死。
        $provider->method('getAssetStatus')->willThrowException(new RuntimeException('回查超时'));
        $provider->expects(self::never())->method('deleteAsset');
        $provider->expects(self::never())->method('deleteAssetGroup');

        $providerAssets = $this->createMock(AssetProviderAssetRepositoryInterface::class);
        $providerAssets->method('findMapping')->willReturn(null);
        $providerAssets->method('saveMapping')->willReturn($this->createMock(AssetProviderAssetModel::class));

        try {
            $this->serviceWithFakedPolling($this->savingAssets(91), $provider, $providerAssets, $logger, 3)->createPublic(
                $this->dataIsolation('org-a', 'user-a', ['org-a']),
                new AssetEntity(['file_key' => 'a.png']),
            );
            self::fail('回查始终没有结论时必须抛出同步失败');
        } catch (BusinessException $exception) {
            self::assertSame(AssetErrorCode::COMPLIANCE_TIMEOUT->value, $exception->getCode());
        }

        self::assertNotNull($this->findLogRecord($logger, '第三方素材状态回查失败，继续等待'));
        self::assertNotNull($this->findLogRecord($logger, '第三方素材合规回查超时'));
    }

    public function testFailedComplianceMarksProviderMappingFailed(): void
    {
        $providerAssets = $this->createMock(AssetProviderAssetRepositoryInterface::class);
        $providerAssets->method('findMapping')->willReturn(null);
        $providerAssets->method('saveMapping')->willReturn($this->createMock(AssetProviderAssetModel::class));

        $provider = $this->createMock(AssetProviderInterface::class);
        $provider->method('getProviderCode')->willReturn('ark');
        $provider->expects(self::once())
            ->method('createAssetGroup')
            ->willReturn(['provider_group_id' => 'group-default']);
        $provider->expects(self::once())
            ->method('createAsset')
            ->willReturn(['provider_asset_id' => 'asset-failed', 'provider_status' => 'FAILED']);
        $provider->expects(self::never())->method('getAssetStatus');
        // 合规不通过时不在这里回收：远程凭证已经落库，何时清理交给人工或补偿任务决定。
        $provider->expects(self::never())->method('deleteAsset');
        $provider->expects(self::never())->method('deleteAssetGroup');

        try {
            $this->serviceWithFakedPolling($this->savingAssets(83), $provider, $providerAssets)->createPublic(
                $this->dataIsolation('org-a', 'user-a', ['org-a']),
                new AssetEntity(['file_key' => 'a.png']),
            );
            self::fail('合规未通过必须抛出 COMPLIANCE_FAILED');
        } catch (BusinessException $exception) {
            self::assertSame(AssetErrorCode::COMPLIANCE_FAILED->value, $exception->getCode());
        }
    }

    public function testGroupAssetSkipsProviderEntirely(): void
    {
        $assets = $this->createMock(AssetRepositoryInterface::class);
        $assets->expects(self::once())->method('save')->willReturnCallback(
            static function (AssetDataIsolation $isolation, AssetEntity $asset): AssetEntity {
                $asset->setId(21);
                return $asset;
            }
        );
        // 素材组只有本地层级：既没有第三方资源，也没有映射行。
        $assets->expects(self::never())->method('update');

        $provider = $this->createMock(AssetProviderInterface::class);
        $provider->expects(self::never())->method('createAssetGroup');
        $provider->expects(self::never())->method('createAsset');
        $provider->expects(self::never())->method('getAssetStatus');
        $providerAssets = $this->createMock(AssetProviderAssetRepositoryInterface::class);
        $providerAssets->expects(self::never())->method('saveMapping');

        $result = $this->serviceWithFakedPolling($assets, $provider, $providerAssets)->createPublic(
            $this->dataIsolation('org-a', 'user-a', ['org-a']),
            new AssetEntity(['asset_kind' => 'GROUP', 'name_i18n' => ['default' => '小灯']]),
        );

        self::assertSame(21, $result->getId());
    }

    public function testAssetCreatesOwnProviderGroupInsteadOfReusingParentGroup(): void
    {
        $assets = $this->savingAssets(31);
        // 父组只用于本地存在性校验：第三方素材组不再复用父组映射。
        $assets->expects(self::once())->method('findById')->willReturn(new AssetEntity([
            'id' => 11,
            'asset_kind' => 'GROUP',
            'name_i18n' => ['default' => '父组'],
        ]));

        $writes = [];
        $providerAssets = $this->createMock(AssetProviderAssetRepositoryInterface::class);
        // 首次同步：本素材还没有第三方凭证，查不到可续用的映射。
        $providerAssets->expects(self::once())->method('findMapping')->willReturn(null);
        $providerAssets->expects(self::exactly(3))->method('saveMapping')->willReturnCallback(
            function (AssetDataIsolation $isolation, ProviderAssetEntity $mapping) use (&$writes): AssetProviderAssetModel {
                $writes[] = [$mapping->getAssetId(), $mapping->getProviderGroupId()];
                return $this->createMock(AssetProviderAssetModel::class);
            }
        );

        $provider = $this->createMock(AssetProviderInterface::class);
        $provider->method('getProviderCode')->willReturn('ark');
        // 专属素材组的组名跟随素材名，而不是父组名。
        $provider->expects(self::once())
            ->method('createAssetGroup')
            ->with(self::callback(static fn (array $payload): bool => $payload['name'] === '头像.png'))
            ->willReturn(['provider_group_id' => 'group-31']);
        $provider->expects(self::once())
            ->method('createAsset')
            ->with(self::callback(static fn (array $payload): bool => $payload['group_id'] === 'group-31'))
            ->willReturn(['provider_asset_id' => 'asset-31', 'provider_status' => 'PASS']);
        $provider->expects(self::never())->method('getAssetStatus');

        $this->serviceWithFakedPolling($assets, $provider, $providerAssets)->createPublic(
            $this->dataIsolation('org-a', 'user-a', ['org-a']),
            new AssetEntity(['file_key' => 'a.png', 'parent_id' => 11, 'name_i18n' => ['default' => '头像.png']]),
        );

        // 三行都落在素材自己的 asset_id 上：处理中 → 组凭证 → 素材凭证。
        self::assertSame([[31, null], [31, 'group-31'], [31, 'group-31']], $writes);
    }

    public function testProviderMetadataKeepsRawResponseInsteadOfMappedWrapper(): void
    {
        $rawResponse = [
            'ResponseMetadata' => ['RequestId' => 'req-1', 'Action' => 'CreateAsset'],
            'Result' => ['Id' => 'asset-51'],
        ];
        $metadata = [];
        $providerAssets = $this->createMock(AssetProviderAssetRepositoryInterface::class);
        $providerAssets->method('findMapping')->willReturn(null);
        $providerAssets->expects(self::exactly(3))->method('saveMapping')->willReturnCallback(
            function (AssetDataIsolation $isolation, ProviderAssetEntity $mapping) use (&$metadata): AssetProviderAssetModel {
                $metadata[] = $mapping->getMetadata();
                return $this->createMock(AssetProviderAssetModel::class);
            }
        );
        $provider = $this->createMock(AssetProviderInterface::class);
        $provider->method('getProviderCode')->willReturn('ark');
        $provider->expects(self::once())
            ->method('createAssetGroup')
            ->willReturn(['provider_group_id' => 'group-51']);
        $provider->expects(self::once())->method('createAsset')->willReturn([
            'provider_asset_id' => 'asset-51',
            'provider_status' => 'PASS',
            'metadata' => $rawResponse,
        ]);

        $this->serviceWithFakedPolling($this->savingAssets(51), $provider, $providerAssets)->createPublic(
            $this->dataIsolation('org-a', 'user-a', ['org-a']),
            new AssetEntity(['file_key' => 'a.png']),
        );

        // 前两行还没有素材，metadata 为空；素材凭证那行只留第三方原始响应，
        // 不把 provider_asset_id / provider_status 在 metadata 列里再抄一遍。
        self::assertSame([null, null, $rawResponse], $metadata);
    }

    public function testAssetWithoutParentAlsoCreatesItsOwnProviderGroup(): void
    {
        $writes = [];
        $providerAssets = $this->createMock(AssetProviderAssetRepositoryInterface::class);
        // 不再有组织默认素材组：没有父组的素材同样自带一个专属组。
        // 首次同步：本素材还没有第三方凭证，查不到可续用的映射。
        $providerAssets->expects(self::once())->method('findMapping')->willReturn(null);
        $providerAssets->expects(self::exactly(3))->method('saveMapping')->willReturnCallback(
            function (AssetDataIsolation $isolation, ProviderAssetEntity $mapping) use (&$writes): AssetProviderAssetModel {
                $writes[] = [$mapping->getAssetId(), $mapping->getProviderGroupId()];
                return $this->createMock(AssetProviderAssetModel::class);
            }
        );
        $provider = $this->createMock(AssetProviderInterface::class);
        $provider->method('getProviderCode')->willReturn('ark');
        $provider->expects(self::once())
            ->method('createAssetGroup')
            ->with(self::callback(static fn (array $payload): bool => $payload['name'] === '风格.png' && $payload['project_name'] === 'default'))
            ->willReturn(['provider_group_id' => 'group-41']);
        $provider->expects(self::once())
            ->method('createAsset')
            ->with(self::callback(static fn (array $payload): bool => $payload['group_id'] === 'group-41'))
            ->willReturn(['provider_asset_id' => 'asset-41', 'provider_status' => 'PASS']);

        $this->serviceWithFakedPolling($this->savingAssets(41), $provider, $providerAssets)->createPublic(
            $this->dataIsolation('org-a', 'user-a', ['org-a']),
            new AssetEntity(['file_key' => 'a.png', 'name_i18n' => ['default' => '风格.png']]),
        );

        self::assertSame([[41, null], [41, 'group-41'], [41, 'group-41']], $writes);
    }

    public function testUnnamedAssetStillGetsANamedProviderGroup(): void
    {
        $provider = $this->createMock(AssetProviderInterface::class);
        $provider->method('getProviderCode')->willReturn('ark');
        // 素材没有名字也不能给火山传一个空组名。
        $provider->expects(self::once())
            ->method('createAssetGroup')
            ->with(self::callback(static fn (array $payload): bool => $payload['name'] === '未命名素材组'))
            ->willReturn(['provider_group_id' => 'group-51']);
        $provider->expects(self::once())
            ->method('createAsset')
            ->willReturn(['provider_asset_id' => 'asset-51', 'provider_status' => 'PASS']);
        $providerAssets = $this->createMock(AssetProviderAssetRepositoryInterface::class);
        $providerAssets->method('findMapping')->willReturn(null);
        $providerAssets->method('saveMapping')->willReturn($this->createMock(AssetProviderAssetModel::class));

        $this->serviceWithFakedPolling($this->savingAssets(51), $provider, $providerAssets)->createPublic(
            $this->dataIsolation('org-a', 'user-a', ['org-a']),
            new AssetEntity(['file_key' => 'a.png']),
        );
    }

    public function testUnknownParentGroupIsRejectedBeforePersisting(): void
    {
        $assets = $this->createMock(AssetRepositoryInterface::class);
        $assets->expects(self::once())->method('findById')->willReturn(null);
        // 本地校验失败直接拒绝：既不留孤儿记录，也不会发出任何第三方调用。
        $assets->expects(self::never())->method('save');
        $assets->expects(self::never())->method('update');

        $providerAssets = $this->createMock(AssetProviderAssetRepositoryInterface::class);
        $providerAssets->expects(self::never())->method('saveMapping');
        $provider = $this->createMock(AssetProviderInterface::class);
        $provider->expects(self::never())->method('createAssetGroup');
        $provider->expects(self::never())->method('createAsset');

        try {
            $this->serviceWithFakedPolling($assets, $provider, $providerAssets)->createPublic(
                $this->dataIsolation('org-a', 'user-a', ['org-a']),
                new AssetEntity(['file_key' => 'a.png', 'parent_id' => 99]),
            );
            self::fail('父组不存在时必须抛出 NOT_FOUND');
        } catch (BusinessException $exception) {
            self::assertSame(AssetErrorCode::NOT_FOUND->value, $exception->getCode());
        }
    }

    public function testParentPointingAtAssetIsRejected(): void
    {
        $assets = $this->createMock(AssetRepositoryInterface::class);
        $assets->expects(self::once())->method('findById')->willReturn(new AssetEntity([
            'id' => 12,
            'asset_kind' => 'ASSET',
        ]));
        $assets->expects(self::never())->method('save');

        $provider = $this->createMock(AssetProviderInterface::class);
        $provider->expects(self::never())->method('createAsset');

        try {
            $this->serviceWithFakedPolling(
                $assets,
                $provider,
                $this->createMock(AssetProviderAssetRepositoryInterface::class),
            )->createPublic(
                $this->dataIsolation('org-a', 'user-a', ['org-a']),
                new AssetEntity(['file_key' => 'a.png', 'parent_id' => 12]),
            );
            self::fail('父级必须是素材组，挂到素材上时必须抛出 NOT_FOUND');
        } catch (BusinessException $exception) {
            self::assertSame(AssetErrorCode::NOT_FOUND->value, $exception->getCode());
        }
    }

    public function testProviderStatusToleratesAnyCaseAndUnknownReviewMode(): void
    {
        self::assertSame(ProviderAssetStatus::PASS, ProviderAssetStatus::fromValue('pass'));
        self::assertSame(ProviderAssetStatus::FAILED, ProviderAssetStatus::fromValue('Failed'));
        self::assertSame(ProviderAssetStatus::PROCESSING, ProviderAssetStatus::fromValue(' processing '));
        self::assertSame(ProviderAssetStatus::PASS, (new ProviderAssetEntity(['provider_status' => 'PASS']))->getProviderStatus());

        // 未知的结论来源一律退回火山：新增枚举值不能让老数据读取直接抛错。
        self::assertSame(ProviderReviewMode::NO_PERSON, ProviderReviewMode::fromValue('no_person'));
        self::assertSame(ProviderReviewMode::REUSED, ProviderReviewMode::fromValue('Reused'));
        self::assertSame(ProviderReviewMode::VOLCENGINE, ProviderReviewMode::fromValue('whatever'));
        self::assertSame(ProviderReviewMode::VOLCENGINE, ProviderReviewMode::fromValue(null));
    }

    public function testDuplicateContentReusesProviderAssetInsteadOfReuploading(): void
    {
        $assets = $this->savingAssets(71);

        $reusable = new ProviderAssetEntity([
            'asset_id' => 50,
            'provider_code' => 'ark',
            'project_name' => 'default',
            'provider_group_id' => 'group-50',
            'provider_asset_id' => 'asset-50',
            'provider_status' => 'PASS',
        ]);

        $writes = [];
        $providerAssets = $this->createMock(AssetProviderAssetRepositoryInterface::class);
        $providerAssets->method('findMapping')->willReturn(null);
        // 同一内容（content_hash 相同）已存在可复用凭证：不再建组、不再建素材、不轮询合规。
        $providerAssets->method('findPassedMappingByContentHash')
            ->with('sha256:abc', 'VolcengineArk', '', '')
            ->willReturn($reusable);
        // 复用写两行：先是处理中的占位，再绑定到已审核通过的第三方素材。
        $providerAssets->expects(self::exactly(2))->method('saveMapping')->willReturnCallback(
            function (AssetDataIsolation $isolation, ProviderAssetEntity $mapping) use (&$writes): AssetProviderAssetModel {
                $writes[] = [
                    $mapping->getProviderAssetId(),
                    $mapping->getProviderStatus()->value,
                    $mapping->getProviderReviewMode()->value,
                ];
                return $this->createMock(AssetProviderAssetModel::class);
            }
        );

        $provider = $this->createMock(AssetProviderInterface::class);
        $provider->method('getProviderCode')->willReturn('ark');
        $provider->expects(self::never())->method('createAssetGroup');
        $provider->expects(self::never())->method('createAsset');
        $provider->expects(self::never())->method('getAssetStatus');

        $this->serviceWithFakedPolling($assets, $provider, $providerAssets)->createPublic(
            $this->dataIsolation('org-a', 'user-a', ['org-a']),
            new AssetEntity(['file_key' => 'a.png', 'content_hash' => 'sha256:abc']),
        );

        // 复用不新建远程资源，结论来源必须是 REUSED：它没有占用第三方素材，用量统计据此排除。
        self::assertSame([
            ['', 'PROCESSING', 'VOLCENGINE'],
            ['asset-50', 'PASS', 'REUSED'],
        ], $writes);
    }

    public function testNoPersonReviewModeSkipsProviderRegistration(): void
    {
        $assets = $this->createMock(AssetRepositoryInterface::class);
        $assets->method('findById')->willReturn(new AssetEntity([
            'id' => 31,
            'organization_code' => 'org-a',
            'user_id' => 'user-a',
            'file_key' => 'a.png',
        ]));

        $writes = [];
        $providerAssets = $this->createMock(AssetProviderAssetRepositoryInterface::class);
        $providerAssets->method('findMapping')->willReturn(null);
        $providerAssets->expects(self::exactly(2))->method('saveMapping')->willReturnCallback(
            function (AssetDataIsolation $isolation, ProviderAssetEntity $mapping) use (&$writes): AssetProviderAssetModel {
                $writes[] = [
                    $mapping->getProviderStatus()->value,
                    $mapping->getProviderReviewMode()->value,
                ];
                return $this->createMock(AssetProviderAssetModel::class);
            }
        );

        $provider = $this->createMock(AssetProviderInterface::class);
        $provider->method('getProviderCode')->willReturn('ark');
        // 视觉预检已确认无人像：不建素材组、不建素材，直接判通过。
        $provider->expects(self::never())->method('createAssetGroup');
        $provider->expects(self::never())->method('createAsset');

        $mapping = $this->domainService($assets, $providerAssets, $provider)->syncPersonalAsset(
            $this->dataIsolation('org-a', 'user-a', ['org-a']),
            31,
            'https://example.test/a.png',
            ProviderReviewMode::NO_PERSON,
        );

        self::assertSame(ProviderAssetStatus::PASS, $mapping->getProviderStatus());
        self::assertSame(ProviderReviewMode::NO_PERSON, $mapping->getProviderReviewMode());
        self::assertSame([
            ['PROCESSING', 'VOLCENGINE'],
            ['PASS', 'NO_PERSON'],
        ], $writes);
    }

    public function testSyncPersonalAssetRegistersNoPersonAssetOnDemandAndResetsSource(): void
    {
        $assets = $this->createMock(AssetRepositoryInterface::class);
        $assets->method('findById')->willReturn(new AssetEntity([
            'id' => 31,
            'organization_code' => 'org-a',
            'user_id' => 'user-a',
            'file_key' => 'a.png',
        ]));

        // 无人像素材当初只落了本地记录：状态通过但 provider_asset_id 为空。
        $existing = $this->createMock(AssetProviderAssetModel::class);
        $existing->method('toArray')->willReturn([
            'asset_id' => 31,
            'provider_code' => 'ark',
            'project_name' => 'default',
            'provider_asset_id' => '',
            'provider_group_id' => null,
            'provider_status' => 'PASS',
            'provider_review_mode' => 'NO_PERSON',
        ]);

        $writes = [];
        $providerAssets = $this->createMock(AssetProviderAssetRepositoryInterface::class);
        $providerAssets->method('findMapping')->willReturn($existing);
        $providerAssets->expects(self::exactly(3))->method('saveMapping')->willReturnCallback(
            function (AssetDataIsolation $isolation, ProviderAssetEntity $mapping) use (&$writes): AssetProviderAssetModel {
                $writes[] = [
                    $mapping->getProviderAssetId(),
                    $mapping->getProviderReviewMode()->value,
                ];
                return $this->createMock(AssetProviderAssetModel::class);
            }
        );

        $provider = $this->createMock(AssetProviderInterface::class);
        $provider->method('getProviderCode')->willReturn('ark');
        $provider->expects(self::once())->method('createAssetGroup')->willReturn(['provider_group_id' => 'group-31']);
        $provider->expects(self::once())
            ->method('createAsset')
            ->willReturn(['provider_asset_id' => 'asset-31', 'provider_status' => 'PASS']);

        $mapping = $this->domainService($assets, $providerAssets, $provider)->syncPersonalAsset(
            $this->dataIsolation('org-a', 'user-a', ['org-a']),
            31,
            'https://example.test/a.png',
        );

        self::assertSame(ProviderAssetStatus::PASS, $mapping->getProviderStatus());
        // 按需注册之后结论来源翻回火山：用量统计不能再把它算成「未占用」。
        self::assertSame(ProviderReviewMode::VOLCENGINE, $mapping->getProviderReviewMode());
        self::assertSame(['asset-31', 'VOLCENGINE'], end($writes));
    }

    public function testDeletingOthersSharedAssetIsRejected(): void
    {
        $repository = $this->createMock(AssetRepositoryInterface::class);
        $repository->method('findById')->willReturn(new AssetEntity([
            'id' => 4,
            'organization_code' => 'org-a',
            'user_id' => 'user-b',
        ]));
        $repository->expects(self::never())->method('delete');

        $service = $this->domainService($repository);

        // 团队分享的素材归创建者，删除接口只放行本人创建的资产。
        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(AssetErrorCode::DELETE_DENIED->value);
        $service->deletePersonal($this->dataIsolation('org-a', 'user-a', ['org-a']), 4);
    }

    public function testDeletingMissingAssetIsRejected(): void
    {
        $repository = $this->createMock(AssetRepositoryInterface::class);
        $repository->method('findById')->willReturn(null);
        $repository->expects(self::never())->method('delete');

        $service = $this->domainService($repository);

        // 不可见的资产按不存在返回，避免通过删除接口探测别人资产是否存在。
        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(AssetErrorCode::NOT_FOUND->value);
        $service->deletePersonal($this->dataIsolation('org-a', 'user-a', ['org-a']), 4);
    }

    public function testDeletingNonEmptyGroupIsRejected(): void
    {
        $repository = $this->createMock(AssetRepositoryInterface::class);
        $repository->method('findById')->willReturn(new AssetEntity([
            'id' => 5,
            'organization_code' => 'org-a',
            'user_id' => 'user-a',
            'asset_kind' => 'GROUP',
        ]));
        $repository->method('hasChildren')->willReturn(true);
        $repository->expects(self::never())->method('delete');

        $service = $this->domainService($repository);

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(AssetErrorCode::GROUP_NOT_EMPTY->value);
        $service->deletePersonal($this->dataIsolation('org-a', 'user-a', ['org-a']), 5);
    }

    public function testDeletingEmptyGroupDeletesLocallyOnly(): void
    {
        $repository = $this->createMock(AssetRepositoryInterface::class);
        $repository->method('findById')->willReturn(new AssetEntity([
            'id' => 9,
            'organization_code' => 'org-a',
            'user_id' => 'user-a',
            'asset_kind' => 'GROUP',
        ]));
        $repository->method('hasChildren')->willReturn(false);
        $repository->expects(self::once())->method('delete')->willReturn(true);

        $providerAssets = $this->createMock(AssetProviderAssetRepositoryInterface::class);
        $providerAssets->expects(self::never())->method('findMapping');

        $service = $this->domainService($repository, $providerAssets);

        self::assertTrue($service->deletePersonal($this->dataIsolation('org-a', 'user-a', ['org-a']), 9));
    }

    public function testDeletingAssetWithoutProviderMappingJustDeletesLocally(): void
    {
        $repository = $this->createMock(AssetRepositoryInterface::class);
        $repository->method('findById')->willReturn(new AssetEntity([
            'id' => 6,
            'organization_code' => 'org-a',
            'user_id' => 'user-a',
            'asset_kind' => 'ASSET',
        ]));
        $repository->expects(self::once())->method('delete')->willReturn(true);

        $providerAssets = $this->createMock(AssetProviderAssetRepositoryInterface::class);
        $providerAssets->method('findMapping')->willReturn(null);
        $providerAssets->expects(self::never())->method('deleteMapping');

        $service = $this->domainService($repository, $providerAssets);

        self::assertTrue($service->deletePersonal($this->dataIsolation('org-a', 'user-a', ['org-a']), 6));
    }

    public function testDeletingLastReferenceReclaimsProviderAsset(): void
    {
        $repository = $this->createMock(AssetRepositoryInterface::class);
        $repository->method('findById')->willReturn(new AssetEntity([
            'id' => 7,
            'organization_code' => 'org-a',
            'user_id' => 'user-a',
            'asset_kind' => 'ASSET',
        ]));
        $repository->expects(self::once())->method('delete')->willReturn(true);

        $mappingModel = $this->createMock(AssetProviderAssetModel::class);
        $mappingModel->method('toArray')->willReturn([
            'asset_id' => 7,
            'provider_code' => 'ark',
            'project_name' => 'default',
            'provider_asset_id' => 'asset-7',
            'provider_group_id' => 'group-7',
            'provider_status' => 'PASS',
            'metadata' => null,
        ]);

        $providerAssets = $this->createMock(AssetProviderAssetRepositoryInterface::class);
        $providerAssets->method('findMapping')->willReturn($mappingModel);
        $providerAssets->expects(self::once())->method('countOtherReferences')->willReturn(0);
        $providerAssets->expects(self::once())->method('deleteMapping')->willReturn(true);

        $provider = $this->createMock(AssetProviderInterface::class);
        $provider->method('getProviderCode')->willReturn('ark');
        $provider->expects(self::once())->method('deleteAsset')->with('asset-7', 'default')->willReturn(true);
        $provider->expects(self::once())->method('deleteAssetGroup')->with('group-7', 'default')->willReturn(true);

        $service = $this->domainService($repository, $providerAssets, $provider);

        self::assertTrue($service->deletePersonal($this->dataIsolation('org-a', 'user-a', ['org-a']), 7));
    }

    public function testDeletingAssetWithOtherReferencesKeepsProviderAsset(): void
    {
        $repository = $this->createMock(AssetRepositoryInterface::class);
        $repository->method('findById')->willReturn(new AssetEntity([
            'id' => 8,
            'organization_code' => 'org-a',
            'user_id' => 'user-a',
            'asset_kind' => 'ASSET',
        ]));
        $repository->expects(self::once())->method('delete')->willReturn(true);

        $mappingModel = $this->createMock(AssetProviderAssetModel::class);
        $mappingModel->method('toArray')->willReturn([
            'asset_id' => 8,
            'provider_code' => 'ark',
            'project_name' => 'default',
            'provider_asset_id' => 'asset-8',
            'provider_group_id' => 'group-8',
            'provider_status' => 'PASS',
            'metadata' => null,
        ]);

        $providerAssets = $this->createMock(AssetProviderAssetRepositoryInterface::class);
        $providerAssets->method('findMapping')->willReturn($mappingModel);
        $providerAssets->expects(self::once())->method('countOtherReferences')->willReturn(1);
        $providerAssets->expects(self::never())->method('deleteMapping');

        $provider = $this->createMock(AssetProviderInterface::class);
        $provider->method('getProviderCode')->willReturn('ark');
        $provider->expects(self::never())->method('deleteAsset');
        $provider->expects(self::never())->method('deleteAssetGroup');

        $service = $this->domainService($repository, $providerAssets, $provider);

        self::assertTrue($service->deletePersonal($this->dataIsolation('org-a', 'user-a', ['org-a']), 8));
    }

    /**
     * 编辑元数据会重建搜索文本；搜索文本由「名称 + 描述 + 标签」整体构成，
     * 实体上已加载的标签必须一起参与重建，否则改个名称就把标签关键词抹掉了。
     */
    public function testUpdateKeepsLoadedTagsInSearchText(): void
    {
        $repository = $this->createMock(AssetRepositoryInterface::class);
        $saved = null;
        $repository->expects(self::once())->method('update')->willReturnCallback(
            static function (AssetDataIsolation $dataIsolation, AssetEntity $asset) use (&$saved): AssetEntity {
                $saved = $asset;
                return $asset;
            }
        );

        $asset = new AssetEntity([
            'id' => 41,
            'organization_code' => 'org-a',
            'user_id' => 'user-a',
            'name_i18n' => ['default' => '新名字'],
            'description_i18n' => ['default' => '新描述'],
        ]);
        $asset->setTags([(new AssetTagEntity())->setNameI18n(['default' => '风景'])]);

        $this->domainService($repository)->update($this->dataIsolation('org-a', 'user-a', ['org-a']), $asset);

        self::assertInstanceOf(AssetEntity::class, $saved);
        self::assertStringContainsString('新名字', (string) $saved->getSearchText());
        self::assertStringContainsString('新描述', (string) $saved->getSearchText());
        self::assertStringContainsString('风景', (string) $saved->getSearchText());
    }

    /**
     * 合规查询只用到项目名，这里预置协程上下文，避免单测里真的去构造火山适配器。
     */
    private function primeProviderContext(): void
    {
        Context::set(AssetDomainService::PROVIDER_CONTEXT_KEY, [
            'provider' => $this->createMock(AssetProviderInterface::class),
            'projectName' => 'default',
        ]);
    }

    /**
     * 组装领域服务，用匿名子类替换第三方适配器并收短合规轮询上限。
     *
     * @param int $pollsBeforeTimeout 允许的回查次数，超过即判超时；传 1 表示回查一次后超时
     */
    private function domainService(
        AssetRepositoryInterface $repository,
        ?AssetProviderAssetRepositoryInterface $providerAssets = null,
        ?AssetProviderInterface $provider = null,
        ?AssetAgreementRepositoryInterface $agreements = null,
        ?LoggerInterface $logger = null,
        int $pollsBeforeTimeout = PHP_INT_MAX,
    ): AssetDomainService {
        return new class($repository, $providerAssets ?? $this->createMock(AssetProviderAssetRepositoryInterface::class), $agreements ?? $this->acceptedAgreement(), $logger ?? new NullLogger(), $this->createMock(AiAbilityDomainService::class), new AssetSearchTextBuilder(), $provider ?? $this->createMock(AssetProviderInterface::class), $pollsBeforeTimeout) extends AssetDomainService {
            private int $pollCount = 0;

            public function __construct(
                AssetRepositoryInterface $assets,
                AssetProviderAssetRepositoryInterface $providerAssets,
                AssetAgreementRepositoryInterface $agreements,
                LoggerInterface $logger,
                AiAbilityDomainService $abilityDomainService,
                AssetSearchTextBuilder $searchTextBuilder,
                private readonly AssetProviderInterface $stubProvider,
                private readonly int $testPollsBeforeTimeout,
            ) {
                parent::__construct($assets, $providerAssets, $agreements, $logger, $abilityDomainService, $searchTextBuilder);
            }

            protected function isComplianceWaitExpired(float $deadline): bool
            {
                return ++$this->pollCount > $this->testPollsBeforeTimeout;
            }

            protected function waitBeforeNextCompliancePoll(): void
            {
            }
        };
    }

    /** 同步编排相关的用例都从这条路进：语义等价于 domainService()，只是参数顺序按替身排列。 */
    private function serviceWithFakedPolling(
        AssetRepositoryInterface $assets,
        AssetProviderInterface $provider,
        AssetProviderAssetRepositoryInterface $providerAssets,
        ?LoggerInterface $logger = null,
        int $pollsBeforeTimeout = PHP_INT_MAX,
    ): AssetDomainService {
        return $this->domainService($assets, $providerAssets, $provider, null, $logger, $pollsBeforeTimeout);
    }

    private function collectingLogger(): AbstractLogger
    {
        return new class extends AbstractLogger {
            /** @var array<int, array{message: string, context: array<string, mixed>}> */
            public array $records = [];

            public function log($level, $message, array $context = []): void
            {
                $this->records[] = ['message' => (string) $message, 'context' => $context];
            }
        };
    }

    /**
     * @return null|array{message: string, context: array<string, mixed>}
     */
    private function findLogRecord(AbstractLogger $logger, string $message): ?array
    {
        foreach ($logger->records as $record) {
            if ($record['message'] === $message) {
                return $record;
            }
        }
        return null;
    }

    /**
     * 返回一个 save 时补齐雪花 ID、update 时原样回传的资产仓储。
     */
    private function savingAssets(int $id): AssetRepositoryInterface
    {
        $assets = $this->createMock(AssetRepositoryInterface::class);
        $assets->method('save')->willReturnCallback(
            static function (AssetDataIsolation $isolation, AssetEntity $asset) use ($id): AssetEntity {
                $asset->setId($id);
                return $asset;
            }
        );
        $assets->method('update')->willReturnCallback(
            static fn (AssetDataIsolation $isolation, AssetEntity $asset): AssetEntity => $asset,
        );
        return $assets;
    }

    private function assetModel(array $attributes): AssetModel
    {
        $attributes = array_merge([
            'id' => 1,
            'organization_code' => 'org-a',
            'user_id' => 'user-a',
            'asset_kind' => 'ASSET',
            'asset_business_type' => 'GENERAL',
            'asset_media_type' => 'IMAGE',
            'name_i18n' => ['default' => 'asset.png'],
            'description_i18n' => null,
            'file_key' => 'asset.png',
            'status' => 1,
        ], $attributes);
        $model = $this->createMock(AssetModel::class);
        $model->method('toArray')->willReturn($attributes);
        $model->method('getKey')->willReturn($attributes['id']);
        return $model;
    }

    private function acceptedAgreement(): AssetAgreementRepositoryInterface
    {
        $agreement = $this->createMock(AssetAgreementRepositoryInterface::class);
        $agreement->method('hasAccepted')->willReturn(true);
        return $agreement;
    }

    private function dataIsolation(string $organization, string $user, array $official): AssetDataIsolation
    {
        $isolation = $this->createMock(AssetDataIsolation::class);
        $isolation->method('getCurrentOrganizationCode')->willReturn($organization);
        $isolation->method('getCurrentUserId')->willReturn($user);
        $isolation->method('getOrganizationCodes')->willReturn($official);
        $isolation->method('getOfficialOrganizationCodes')->willReturn(['official']);
        return $isolation;
    }

    /**
     * ResourceVisibilityDomainService 是 readonly class，无法 createMock，用真实实例 + mock 仓储。
     */
    private function visibilityDomainService(): ResourceVisibilityDomainService
    {
        return new ResourceVisibilityDomainService(
            $this->createMock(ResourceVisibilityRepositoryInterface::class),
            $this->createMock(MagicDepartmentUserRepositoryInterface::class),
        );
    }
}

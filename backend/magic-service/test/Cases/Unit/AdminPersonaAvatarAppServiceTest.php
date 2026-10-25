<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit;

use App\Application\Asset\Service\AdminPersonaAvatarAppService;
use App\Domain\Asset\Entity\AssetDataIsolation;
use App\Domain\Asset\Entity\AssetEntity;
use App\Domain\Asset\Entity\ValueObject\AssetBusinessType;
use App\Domain\Asset\Service\AssetDomainService;
use App\Domain\Asset\Service\AssetTagDomainService;
use App\Domain\Contact\Repository\Facade\MagicDepartmentUserRepositoryInterface;
use App\Domain\Permission\Repository\Facade\ResourceVisibilityRepositoryInterface;
use App\Domain\Permission\Service\ResourceVisibilityDomainService;
use App\ErrorCode\AssetErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Interfaces\Asset\DTO\Request\CreateAssetRequestDTO;
use App\Interfaces\Asset\DTO\Request\UpdateAssetRequestDTO;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;

/**
 * 头像库后台服务：类型由服务端决定、只落本地、标签随素材同步，且不能改删其它业务类型的官方素材。
 *
 * @internal
 */
final class AdminPersonaAvatarAppServiceTest extends TestCase
{
    private ?ContainerInterface $containerBeforeTest = null;

    protected function setUp(): void
    {
        parent::setUp();
        if (ApplicationContext::hasContainer()) {
            $this->containerBeforeTest = ApplicationContext::getContainer();
        }
        // 抛业务异常时需要翻译器和错误码映射，其余依赖用不到。
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
                return new class {};
            }

            public function has(string $id): bool
            {
                return in_array($id, [ConfigInterface::class, TranslatorInterface::class], true);
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

    public function testCreateForcesAvatarTypeSavesLocallyAndSyncsTags(): void
    {
        $domain = $this->createMock(AssetDomainService::class);
        $domain->expects(self::never())->method('createPublic');
        $domain->expects(self::once())->method('createPublicLocalOnly')->willReturnCallback(
            static function (AssetDataIsolation $isolation, AssetEntity $asset): AssetEntity {
                // 调用方传的 GROUP 和 GENERAL 都会被服务端覆盖。
                self::assertSame(AssetBusinessType::PERSONA_AVATAR, $asset->getAssetBusinessType());
                self::assertFalse($asset->getAssetKind()->isGroup());
                $asset->setId(7);
                return $asset;
            }
        );
        $tags = $this->createMock(AssetTagDomainService::class);
        $tags->expects(self::once())->method('syncAssetTags')->with(
            self::anything(),
            self::callback(static fn (AssetEntity $asset): bool => $asset->getId() === 7),
            [11, 12],
        );

        $request = new CreateAssetRequestDTO();
        $request->assetKind = 'GROUP';
        $request->assetBusinessType = 'GENERAL';
        $request->name = 'p_cn_01';
        $request->fileKey = 'org/persona-avatars/p_cn_01.webp';
        $request->setTagIds([11, 12]);

        $service = $this->service($domain, $tags);
        $saved = $service->createAvatar($this->isolation(), $request);

        self::assertSame('https://files.test/org/persona-avatars/p_cn_01.webp', $saved->getFileUrl());
        self::assertSame(['sync:7'], $service->visibilityCalls);
    }

    public function testCreateRequiresAFileKey(): void
    {
        $domain = $this->createMock(AssetDomainService::class);
        $domain->expects(self::never())->method('createPublicLocalOnly');

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(AssetErrorCode::FILE_REQUIRED->value);
        $this->service($domain, $this->createMock(AssetTagDomainService::class))
            ->createAvatar($this->isolation(), new CreateAssetRequestDTO());
    }

    public function testOtherBusinessTypesCannotBeUpdatedOrDeleted(): void
    {
        $generalAsset = new AssetEntity(['id' => 5, 'organization_code' => 'official', 'asset_business_type' => 'GENERAL']);
        $domain = $this->createMock(AssetDomainService::class);
        $domain->method('findPublic')->willReturn($generalAsset);
        $domain->expects(self::never())->method('updatePublic');
        $domain->expects(self::never())->method('deletePublic');
        $service = $this->service($domain, $this->createMock(AssetTagDomainService::class));

        self::assertNull($service->updateAvatar($this->isolation(), 5, new UpdateAssetRequestDTO(), [1]));
        self::assertFalse($service->deleteAvatar($this->isolation(), 5));
    }

    public function testAvatarsCanBeDeleted(): void
    {
        $avatar = new AssetEntity(['id' => 6, 'organization_code' => 'official', 'asset_business_type' => AssetBusinessType::PERSONA_AVATAR]);
        $domain = $this->createMock(AssetDomainService::class);
        $domain->method('findPublic')->willReturn($avatar);
        $domain->expects(self::once())->method('deletePublic')->willReturn(true);

        $service = $this->service($domain, $this->createMock(AssetTagDomainService::class));

        self::assertTrue($service->deleteAvatar($this->isolation(), 6));
        // 素材删除后，可见性授权记录不能悬空。
        self::assertSame(['clear:6'], $service->visibilityCalls);
    }

    /** @return AdminPersonaAvatarAppService&object{visibilityCalls: string[]} */
    private function service(AssetDomainService $domain, AssetTagDomainService $tags): AdminPersonaAvatarAppService
    {
        $visibility = new ResourceVisibilityDomainService(
            $this->createMock(ResourceVisibilityRepositoryInterface::class),
            $this->createMock(MagicDepartmentUserRepositoryInterface::class),
        );
        // 文件链接解析走对象存储、可见性登记走权限层，这里用固定地址和调用记录代替，其余逻辑保持真实。
        return new class($domain, $visibility, $tags) extends AdminPersonaAvatarAppService {
            /** @var string[] */
            public array $visibilityCalls = [];

            protected function resolveAssetFileUrls(array $assets): void
            {
                foreach ($assets as $asset) {
                    $asset->setFileUrl('https://files.test/' . $asset->getFileKey());
                }
            }

            protected function syncPublicVisibility(AssetDataIsolation $dataIsolation, AssetEntity $asset): void
            {
                $this->visibilityCalls[] = 'sync:' . $asset->getId();
            }

            protected function clearAssetVisibility(AssetDataIsolation $dataIsolation, null|AssetEntity|int|string $asset): void
            {
                $this->visibilityCalls[] = 'clear:' . $asset;
            }
        };
    }

    private function isolation(): AssetDataIsolation
    {
        $isolation = $this->createMock(AssetDataIsolation::class);
        $isolation->method('isOfficialOrganization')->willReturn(true);
        $isolation->method('getCurrentOrganizationCode')->willReturn('official');
        $isolation->method('getCurrentUserId')->willReturn('admin-1');
        $isolation->method('getOrganizationCodes')->willReturn(['official']);
        $isolation->method('getOfficialOrganizationCodes')->willReturn(['official']);
        return $isolation;
    }
}

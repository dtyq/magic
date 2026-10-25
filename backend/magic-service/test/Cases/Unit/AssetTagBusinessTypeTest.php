<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit;

use App\Domain\Asset\Entity\AssetDataIsolation;
use App\Domain\Asset\Entity\AssetEntity;
use App\Domain\Asset\Entity\AssetTagEntity;
use App\Domain\Asset\Entity\ValueObject\AssetBusinessType;
use App\Domain\Asset\Entity\ValueObject\AssetTagNodeType;
use App\Domain\Asset\Repository\Facade\AssetRepositoryInterface;
use App\Domain\Asset\Repository\Facade\AssetTagRelationRepositoryInterface;
use App\Domain\Asset\Repository\Facade\AssetTagRepositoryInterface;
use App\Domain\Asset\Service\AssetSearchTextBuilder;
use App\Domain\Asset\Service\AssetTagDomainService;
use App\ErrorCode\AssetErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;

/**
 * 标签业务类型：标签组与标签、素材与标签必须同类型；用户侧列表按类型过滤。
 *
 * @internal
 */
final class AssetTagBusinessTypeTest extends TestCase
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

    public function testNewTagsDefaultToGeneralBusinessType(): void
    {
        self::assertSame('GENERAL', (new AssetTagEntity())->getBusinessType());
        self::assertSame('GENERAL', (new AssetTagEntity())->setBusinessType('  ')->getBusinessType());
        self::assertSame('PERSONA_AVATAR', (new AssetTagEntity())->setBusinessType('PERSONA_AVATAR')->toArray()['business_type']);
    }

    public function testCreateOfficialTagInheritsBusinessTypeAndSavesIt(): void
    {
        $group = $this->tag(10, 0, AssetBusinessType::PERSONA_AVATAR);
        $tags = $this->createMock(AssetTagRepositoryInterface::class);
        $tags->method('findById')->willReturn($group);
        $tags->expects(self::once())->method('save')->willReturnCallback(
            static fn (AssetDataIsolation $isolation, AssetTagEntity $entity): AssetTagEntity => $entity
        );

        $created = $this->service($tags)->createOfficial(
            $this->isolation(),
            'CN',
            AssetTagNodeType::Tag,
            10,
            AssetBusinessType::PERSONA_AVATAR,
        );

        self::assertSame(AssetBusinessType::PERSONA_AVATAR, $created->getBusinessType());
        self::assertSame(10, $created->getParentId());
    }

    public function testTagCannotBeCreatedUnderGroupOfAnotherBusinessType(): void
    {
        $generalGroup = $this->tag(10, 0, AssetBusinessType::GENERAL);
        $tags = $this->createMock(AssetTagRepositoryInterface::class);
        $tags->method('findById')->willReturn($generalGroup);
        $tags->expects(self::never())->method('save');

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(AssetErrorCode::TAG_STRUCTURE_INVALID->value);
        $this->service($tags)->createOfficial(
            $this->isolation(),
            'CN',
            AssetTagNodeType::Tag,
            10,
            AssetBusinessType::PERSONA_AVATAR,
        );
    }

    public function testAssetCannotUseTagsOfAnotherBusinessType(): void
    {
        $avatarTag = $this->tag(20, 10, AssetBusinessType::PERSONA_AVATAR);
        $tags = $this->createMock(AssetTagRepositoryInterface::class);
        $tags->method('findById')->willReturn($avatarTag);
        $tags->method('hasChildren')->willReturn(false);

        // 通用素材（业务类型缺省）不能挂头像库的标签。
        $generalAsset = new AssetEntity(['id' => 1, 'organization_code' => 'official']);
        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(AssetErrorCode::TAG_NOT_ALLOWED->value);
        $this->service($tags)->syncAssetTags($this->isolation(), $generalAsset, [20]);
    }

    public function testVisibleTagsAreFilteredByRequestedBusinessType(): void
    {
        $tags = $this->createMock(AssetTagRepositoryInterface::class);
        $tags->expects(self::once())->method('queryVisibleTree')
            ->with(self::anything(), 'user-a', 'GENERAL')
            ->willReturn([]);

        self::assertSame([], $this->service($tags)->listVisible($this->isolation(), 'GENERAL'));
    }

    private function service(AssetTagRepositoryInterface $tags): AssetTagDomainService
    {
        return new AssetTagDomainService(
            $tags,
            $this->createMock(AssetTagRelationRepositoryInterface::class),
            $this->createMock(AssetRepositoryInterface::class),
            new AssetSearchTextBuilder(),
        );
    }

    private function isolation(): AssetDataIsolation
    {
        $isolation = $this->createMock(AssetDataIsolation::class);
        $isolation->method('getCurrentOrganizationCode')->willReturn('official');
        $isolation->method('getCurrentUserId')->willReturn('user-a');
        $isolation->method('getOrganizationCodes')->willReturn(['official']);
        return $isolation;
    }

    private function tag(int $id, int $parentId, string $businessType): AssetTagEntity
    {
        return (new AssetTagEntity())
            ->setId($id)
            ->setOrganizationCode('official')
            ->setParentId($parentId)
            ->setNameI18n(['default' => 'x'])
            ->setBusinessType($businessType);
    }
}

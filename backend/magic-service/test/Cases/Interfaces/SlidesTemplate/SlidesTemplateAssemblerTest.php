<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Interfaces\SlidesTemplate;

use App\Domain\SlidesTemplate\Entity\SlidesTemplateCategoryEntity;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateEntity;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateTagEntity;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateOwnerType;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateSourceType;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Context\CoContext;
use App\Interfaces\SlidesTemplate\Assembler\SlidesTemplateAssembler;
use App\Interfaces\SlidesTemplate\Assembler\SlidesTemplateCategoryAssembler;
use App\Interfaces\SlidesTemplate\Assembler\SlidesTemplateTagAssembler;
use App\Interfaces\SlidesTemplate\DTO\Response\AdminSlidesTemplateDetailDTO;
use App\Interfaces\SlidesTemplate\DTO\Response\SlidesTemplateCountDTO;
use App\Interfaces\SlidesTemplate\DTO\Response\SlidesTemplateFileUrlDTO;
use App\Interfaces\SlidesTemplate\DTO\Response\SlidesTemplateListPageDTO;
use App\Interfaces\SlidesTemplate\DTO\Response\SlidesTemplatePublicDetailDTO;
use App\Interfaces\SlidesTemplate\DTO\Response\SlidesTemplatePublicListItemDTO;
use App\Interfaces\SlidesTemplate\DTO\Response\UsedSlidesTemplatePublicListItemDTO;
use Hyperf\Codec\Packer\PhpSerializerPacker;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionClass;
use RuntimeException;

/**
 * @internal
 */
class SlidesTemplateAssemblerTest extends TestCase
{
    private static bool $hadOriginalContainer = false;

    private static ?ContainerInterface $originalContainer = null;

    public static function setUpBeforeClass(): void
    {
        self::$hadOriginalContainer = ApplicationContext::hasContainer();
        self::$originalContainer = self::$hadOriginalContainer ? ApplicationContext::getContainer() : null;

        ApplicationContext::setContainer(new class implements ContainerInterface {
            public function get(string $id)
            {
                return match ($id) {
                    PhpSerializerPacker::class => new PhpSerializerPacker(),
                    ConfigInterface::class => new class implements ConfigInterface {
                        public function get(string $key, mixed $default = null): mixed
                        {
                            return match ($key) {
                                'service_provider.office_organization' => 'OFFICIAL_ORG',
                                default => $default,
                            };
                        }

                        public function has(string $keys): bool
                        {
                            return $keys === 'service_provider.office_organization';
                        }

                        public function set(string $key, mixed $value): void
                        {
                        }
                    },
                    default => throw new RuntimeException('Unexpected container dependency: ' . $id),
                };
            }

            public function has(string $id): bool
            {
                return in_array($id, [ConfigInterface::class, PhpSerializerPacker::class], true);
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

    public function testCreatePublicPageDTOKeepsResponseFieldNames(): void
    {
        $template = $this->makeTemplate();

        $dto = SlidesTemplateAssembler::createPublicListPageDTO([$template], new Page(2, 10));

        $this->assertInstanceOf(SlidesTemplateListPageDTO::class, $dto);
        $this->assertInstanceOf(SlidesTemplatePublicListItemDTO::class, $dto->getList()[0]);
        $this->assertSame([
            'page' => 2,
            'page_size' => 10,
            'list' => [[
                'id' => '123',
                'code' => 'PPT-65f2c8a42d7b0-12345678',
                'source_type' => 'SYSTEM',
                'category_code' => 'PPT-CATE-business',
                'label' => '职场白皮书',
                'description' => '适用于企业汇报。',
                'thumbnail_url' => 'https://signed.example/thumb.png',
                'color' => '#112233',
                'colors' => ['#112233', '#445566'],
                'collage_url' => 'https://signed.example/collage.png',
                'sort' => 100,
                'usage_count' => 215,
                'is_official' => false,
                'is_favorite' => false,
                'status' => 1,
                'created_at' => null,
                'updated_at' => null,
            ]],
        ], $dto->toArray());
    }

    public function testCreateUserTemplatePageDTOIncludesProjectNavigationFieldsOnlyForUserScope(): void
    {
        $template = $this->makeTemplate()
            ->setProjectId('935281873559658498')
            ->setProjectDirectoryId('945653402610257921');

        $publicItem = SlidesTemplateAssembler::createPublicListPageDTO([$template], new Page(1, 20))->toArray()['list'][0];
        $userItem = SlidesTemplateAssembler::createPublicListPageDTO([$template], new Page(1, 20), [], true)->toArray()['list'][0];

        self::assertArrayNotHasKey('project', $publicItem);
        self::assertSame([
            'id' => '935281873559658498',
            'directory_id' => '945653402610257921',
        ], $userItem['project']);

        $template->setProjectId(null)->setProjectDirectoryId(null);
        $userItemWithoutProject = SlidesTemplateAssembler::createPublicListPageDTO([$template], new Page(1, 20), [], true)->toArray()['list'][0];
        self::assertNull($userItemWithoutProject['project']);
    }

    public function testCreatePublicListDTOUsesCurrentLanguageForLocalizedFields(): void
    {
        CoContext::setLanguage('en_US');

        try {
            $item = SlidesTemplateAssembler::createPublicListItemDTO($this->makeTemplate())->toArray();

            self::assertSame('Corporate Whitepaper', $item['label']);
            self::assertSame('For business reviews.', $item['description']);
        } finally {
            CoContext::setLanguage('zh_CN');
        }
    }

    public function testCreatePublicDetailDTOReturnsPublicAssetsWithoutTemplateFileUrl(): void
    {
        $template = $this->makeTemplate();

        $dto = SlidesTemplateAssembler::createPublicDetailDTO($template);

        $this->assertInstanceOf(SlidesTemplatePublicDetailDTO::class, $dto);
        $this->assertSame([
            'id' => '123',
            'code' => 'PPT-65f2c8a42d7b0-12345678',
            'source_type' => 'SYSTEM',
            'category_code' => 'PPT-CATE-business',
            'label' => [
                'zh_CN' => '职场白皮书',
                'en_US' => 'Corporate Whitepaper',
            ],
            'description' => [
                'zh_CN' => '适用于企业汇报。',
                'en_US' => 'For business reviews.',
            ],
            'thumbnail_url' => 'https://signed.example/thumb.png',
            'color' => '#112233',
            'colors' => ['#112233', '#445566'],
            'collage_url' => 'https://signed.example/collage.png',
            'preview_image_urls' => [],
            'preview_url' => 'https://www.letsmagic.cn/share/files/1',
            'sort' => 100,
            'usage_count' => 215,
            'is_official' => false,
            'is_favorite' => false,
            'status' => 1,
            'created_at' => null,
            'updated_at' => null,
            'tags' => [],
        ], $dto->toArray());
        $this->assertArrayNotHasKey('template_file_url', $dto->toArray());
    }

    public function testCreatePublicDetailDTOIncludesProjectOnlyForTemplateOwner(): void
    {
        $template = $this->makeTemplate()
            ->setOwnerType(SlidesTemplateOwnerType::User)
            ->setOwnerId('user-1')
            ->setProjectId('935281873559658498')
            ->setProjectDirectoryId('945653402610257921');

        $ownerDetail = SlidesTemplateAssembler::createPublicDetailDTO($template, 'user-1')->toArray();
        $otherUserDetail = SlidesTemplateAssembler::createPublicDetailDTO($template, 'user-2')->toArray();
        $anonymousDetail = SlidesTemplateAssembler::createPublicDetailDTO($template)->toArray();
        $officialDetail = SlidesTemplateAssembler::createPublicDetailDTO(
            $template->setOwnerType(SlidesTemplateOwnerType::Official),
            'user-1'
        )->toArray();

        self::assertSame([
            'id' => '935281873559658498',
            'directory_id' => '945653402610257921',
        ], $ownerDetail['project']);
        self::assertArrayNotHasKey('project', $otherUserDetail);
        self::assertArrayNotHasKey('project', $anonymousDetail);
        self::assertArrayNotHasKey('project', $officialDetail);
    }

    public function testCreateUsedListPageDTOIncludesLatestUsedAtOnlyForUsedTemplates(): void
    {
        $template = $this->makeTemplate();

        $dto = SlidesTemplateAssembler::createUsedListPageDTO(
            [$template],
            new Page(1, 20),
            [],
            [$template->getCode() => '2026-08-11 10:00:00']
        );

        self::assertInstanceOf(UsedSlidesTemplatePublicListItemDTO::class, $dto->getList()[0]);
        self::assertSame('2026-08-11 10:00:00', $dto->toArray()['list'][0]['latest_used_at']);
        self::assertArrayNotHasKey('tags', $dto->toArray()['list'][0]);
        self::assertArrayNotHasKey('latest_used_at', SlidesTemplateAssembler::createPublicListPageDTO([$template], new Page(1, 20))->toArray()['list'][0]);
    }

    public function testCreateCountDTO(): void
    {
        $dto = SlidesTemplateAssembler::createCountDTO(1780, 56000, 88);

        $this->assertInstanceOf(SlidesTemplateCountDTO::class, $dto);
        $this->assertSame([
            'total' => 1780,
            'total_usage_count' => 56000,
            'template_count_today_growth' => 88,
        ], $dto->toArray());
    }

    public function testCreateAdminDetailIsFullyPopulatedWithoutTemplateFileUrl(): void
    {
        $template = $this->makeTemplate();

        $detailDTO = SlidesTemplateAssembler::createAdminDetailDTO($template);
        $detail = $detailDTO->toArray();

        $this->assertInstanceOf(AdminSlidesTemplateDetailDTO::class, $detailDTO);
        $this->assertSame('123', $detail['id']);
        $this->assertSame('PPT-65f2c8a42d7b0-12345678', $detail['code']);
        $this->assertSame('SYSTEM', $detail['source_type']);
        $this->assertSame('slides/template.zip', $detail['template_file_key']);
        $this->assertSame(1, $detail['status']);
        $this->assertSame([], $detail['tags']);
        $this->assertArrayNotHasKey('category', $detail);
        $this->assertArrayNotHasKey('template_file_url', $detail);
    }

    public function testCreateFileUrlDTOOnlyExposesTemplateFileUrlThroughDedicatedResponse(): void
    {
        $fileUrlDTO = SlidesTemplateAssembler::createFileUrlDTO($this->makeTemplate());

        $this->assertInstanceOf(SlidesTemplateFileUrlDTO::class, $fileUrlDTO);
        $this->assertSame([
            'code' => 'PPT-65f2c8a42d7b0-12345678',
            'source_type' => 'SYSTEM',
            'category_code' => 'PPT-CATE-business',
            'label' => [
                'zh_CN' => '职场白皮书',
                'en_US' => 'Corporate Whitepaper',
            ],
            'template_file_url' => 'https://signed.example/template.zip',
        ], $fileUrlDTO->toArray());
    }

    public function testPersonalTemplateInOfficialOrganizationIsNotOfficial(): void
    {
        $template = $this->makeTemplate()
            ->setOrganizationCode('OFFICIAL_ORG')
            ->setOwnerType(SlidesTemplateOwnerType::User)
            ->setOwnerId('user-1');

        $this->assertFalse(SlidesTemplateAssembler::createPublicListItemDTO($template)->toArray()['is_official']);
        $this->assertFalse(SlidesTemplateAssembler::createPublicDetailDTO($template)->toArray()['is_official']);

        $template->setOwnerType(SlidesTemplateOwnerType::Official)->setOwnerId('OFFICIAL_ORG');

        $this->assertTrue(SlidesTemplateAssembler::createPublicListItemDTO($template)->toArray()['is_official']);
        $this->assertTrue(SlidesTemplateAssembler::createPublicDetailDTO($template)->toArray()['is_official']);
    }

    public function testCreateAdminPageDTOIncludesCategory(): void
    {
        $template = $this->makeTemplate();
        $category = new SlidesTemplateCategoryEntity();
        $category->setId(456)
            ->setOrganizationCode('OFFICIAL_ORG')
            ->setCode('PPT-CATE-business')
            ->setNameI18n(['zh_CN' => '商务', 'en_US' => 'Business'])
            ->setSort(200);

        $dto = SlidesTemplateAssembler::createPageDTO(
            [$template],
            new Page(1, 20),
            1,
            true,
            ['PPT-CATE-business' => $category]
        );

        $item = $dto->getList()[0]->toArray();
        $this->assertSame([
            'id' => '456',
            'code' => 'PPT-CATE-business',
            'name_i18n' => [
                'zh_CN' => '商务',
                'en_US' => 'Business',
            ],
            'status' => 1,
            'sort' => 200,
            'is_official' => true,
        ], $item['category']);
        $this->assertArrayNotHasKey('template_count', $item['category']);
        unset($item['category']);

        $this->assertSame([
            'id' => '123',
            'organization_code' => 'CURRENT_ORG',
            'code' => 'PPT-65f2c8a42d7b0-12345678',
            'source_type' => 'SYSTEM',
            'category_code' => 'PPT-CATE-business',
            'label' => [
                'zh_CN' => '职场白皮书',
                'en_US' => 'Corporate Whitepaper',
            ],
            'description' => [
                'zh_CN' => '适用于企业汇报。',
                'en_US' => 'For business reviews.',
            ],
            'thumbnail_file_key' => 'slides/thumb.png',
            'thumbnail_url' => 'https://signed.example/thumb.png',
            'colors' => ['#112233', '#445566'],
            'collage_file_key' => 'slides/collage.png',
            'collage_url' => 'https://signed.example/collage.png',
            'preview_image_file_keys' => [],
            'preview_image_urls' => [],
            'template_file_key' => 'slides/template.zip',
            'preview_url' => 'https://www.letsmagic.cn/share/files/1',
            'status' => 1,
            'sort' => 100,
            'base_usage_count' => 100,
            'actual_usage_count' => 23,
            'total_usage_count' => 215,
            'usage_count' => 215,
            'created_uid' => 'user-1',
            'updated_uid' => 'user-2',
            'created_at' => null,
            'updated_at' => null,
            'tags' => [],
        ], $item);
    }

    public function testCreatePublicCategoryPageDTODoesNotIncludeTemplateCount(): void
    {
        $category = new SlidesTemplateCategoryEntity();
        $category->setId(123)
            ->setOrganizationCode('OFFICIAL_ORG')
            ->setCode('PPT-CATE-business')
            ->setNameI18n(['zh_CN' => '商务', 'en_US' => 'Business'])
            ->setSort(100)
            ->setTemplateCount(3);

        $dto = SlidesTemplateCategoryAssembler::createPageDTO([$category], new Page(1, 200), 1, false);

        $this->assertSame([
            'page' => 1,
            'page_size' => 200,
            'total' => 1,
            'list' => [[
                'id' => '123',
                'code' => 'PPT-CATE-business',
                'name' => '商务',
                'sort' => 100,
                'is_official' => true,
            ]],
        ], $dto->toArray());
        $this->assertArrayNotHasKey('template_count', $dto->toArray()['list'][0]);
        $this->assertArrayNotHasKey('name_i18n', $dto->toArray()['list'][0]);
    }

    public function testCreatePublicTagGroupsExcludeLocalizedNameFields(): void
    {
        $child = (new SlidesTemplateTagEntity())
            ->setId(2)
            ->setCode('modern')
            ->setNameI18n(['zh_CN' => '现代', 'en_US' => 'Modern'])
            ->setSort(2);
        $group = (new SlidesTemplateTagEntity())
            ->setId(1)
            ->setCode('style')
            ->setNameI18n(['zh_CN' => '风格', 'en_US' => 'Style'])
            ->setSort(1)
            ->setChildren([$child]);

        $item = SlidesTemplateTagAssembler::createGroupListDTO([$group])[0];

        self::assertSame('风格', $item['name']);
        self::assertArrayNotHasKey('name_i18n', $item);
        self::assertSame('现代', $item['tags'][0]['name']);
        self::assertArrayNotHasKey('name_i18n', $item['tags'][0]);
    }

    private function makeTemplate(): SlidesTemplateEntity
    {
        $template = new SlidesTemplateEntity();
        $template->setId(123)
            ->setOrganizationCode('CURRENT_ORG')
            ->setCode('PPT-65f2c8a42d7b0-12345678')
            ->setSourceType(SlidesTemplateSourceType::System)
            ->setCategoryCode('PPT-CATE-business')
            ->setLabel([
                'zh_CN' => '职场白皮书',
                'en_US' => 'Corporate Whitepaper',
            ])
            ->setDescription([
                'zh_CN' => '适用于企业汇报。',
                'en_US' => 'For business reviews.',
            ])
            ->setThumbnailFileKey('slides/thumb.png')
            ->setThumbnailUrl('https://signed.example/thumb.png')
            ->setColors(['#112233', '#445566'])
            ->setCollageFileKey('slides/collage.png')
            ->setCollageUrl('https://signed.example/collage.png')
            ->setTemplateFileKey('slides/template.zip')
            ->setTemplateFileUrl('https://signed.example/template.zip')
            ->setPreviewUrl('https://www.letsmagic.cn/share/files/1')
            ->setStatus(1)
            ->setSort(100)
            ->setBaseUsageCount(100)
            ->setActualUsageCount(23)
            ->setTotalUsageCount(215)
            ->setCreatedUid('user-1')
            ->setUpdatedUid('user-2');

        return $template;
    }
}

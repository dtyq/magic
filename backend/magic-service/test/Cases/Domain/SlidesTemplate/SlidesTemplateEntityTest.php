<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Domain\SlidesTemplate;

use App\Domain\SlidesTemplate\Entity\SlidesTemplateCategoryEntity;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateEntity;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateOwnerType;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateSourceType;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateStatus;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class SlidesTemplateEntityTest extends TestCase
{
    public function testGenerateNewCodeUsesSlidePrefixAndSafeUniqueSuffix(): void
    {
        $code = SlidesTemplateEntity::generateNewCode();

        $this->assertMatchesRegularExpression('/^SLIDE-[0-9a-f]+-[0-9]+$/', $code);
        $this->assertLessThanOrEqual(64, strlen($code));
        $this->assertNotSame($code, SlidesTemplateEntity::generateNewCode());
    }

    public function testGenerateNewCategoryCodeUsesSlideCatePrefixAndSafeUniqueSuffix(): void
    {
        $code = SlidesTemplateCategoryEntity::generateNewCode();

        $this->assertMatchesRegularExpression('/^SLIDE-CATE-[0-9a-f]+-[0-9]+$/', $code);
        $this->assertLessThanOrEqual(64, strlen($code));
        $this->assertNotSame($code, SlidesTemplateCategoryEntity::generateNewCode());
    }

    public function testStatusEnumIdentifiesEnabledAndDisabled(): void
    {
        $this->assertTrue(SlidesTemplateStatus::Enabled->isEnabled());
        $this->assertFalse(SlidesTemplateStatus::Disabled->isEnabled());
        $this->assertSame(1, SlidesTemplateStatus::Enabled->value);
        $this->assertSame(0, SlidesTemplateStatus::Disabled->value);
    }

    public function testSourceTypeEnumIdentifiesCustomAndSystemTemplates(): void
    {
        $this->assertTrue(SlidesTemplateSourceType::System->isSystem());
        $this->assertFalse(SlidesTemplateSourceType::Custom->isSystem());
        $this->assertSame('CUSTOM', SlidesTemplateSourceType::Custom->value);
        $this->assertSame('SYSTEM', SlidesTemplateSourceType::System->value);
    }

    public function testCategoryCodeCanBeStoredOnTemplate(): void
    {
        $entity = new SlidesTemplateEntity();
        $entity->setCategoryCode('PPT-CATE-business');

        $this->assertSame('PPT-CATE-business', $entity->getCategoryCode());
        $this->assertSame('PPT-CATE-business', $entity->toArray()['category_code'] ?? null);
    }

    public function testOwnerCanBeStoredOnTemplate(): void
    {
        $entity = new SlidesTemplateEntity();
        $entity->setOwnerType(SlidesTemplateOwnerType::User)
            ->setOwnerId('user-1');

        $this->assertSame(SlidesTemplateOwnerType::User, $entity->getOwnerType());
        $this->assertSame('user-1', $entity->getOwnerId());
        $this->assertSame('USER', $entity->toArray()['owner_type'] ?? null);
        $this->assertSame('user-1', $entity->toArray()['owner_id'] ?? null);
    }

    public function testToArrayKeepsTemplateCoreFields(): void
    {
        $entity = new SlidesTemplateEntity();
        $entity->setId('123')
            ->setOrganizationCode('OFFICIAL_ORG')
            ->setCode('PPT-65f2c8a42d7b0-12345678')
            ->setSourceType(SlidesTemplateSourceType::System)
            ->setLabel([
                'zh_CN' => '职场白皮书',
                'en_US' => 'Corporate Whitepaper',
            ])
            ->setDescription([
                'zh_CN' => '适用于企业汇报。',
                'en_US' => 'For business reviews.',
            ])
            ->setThumbnailFileKey('slides/thumb.png')
            ->setCollageFileKey('slides/collage.png')
            ->setTemplateFileKey('slides/template.zip')
            ->setPreviewUrl('https://www.letsmagic.cn/share/files/1')
            ->setStatus(1)
            ->setSort(100)
            ->setCreatedUid('user-1')
            ->setUpdatedUid('user-2');

        $this->assertSame([
            'id' => 123,
            'organization_code' => 'OFFICIAL_ORG',
            'owner_type' => 'OFFICIAL',
            'code' => 'PPT-65f2c8a42d7b0-12345678',
            'source_type' => 'SYSTEM',
            'label' => [
                'zh_CN' => '职场白皮书',
                'en_US' => 'Corporate Whitepaper',
            ],
            'description' => [
                'zh_CN' => '适用于企业汇报。',
                'en_US' => 'For business reviews.',
            ],
            'thumbnail_file_key' => 'slides/thumb.png',
            'colors' => [],
            'collage_file_key' => 'slides/collage.png',
            'preview_image_file_keys' => [],
            'template_file_key' => 'slides/template.zip',
            'preview_url' => 'https://www.letsmagic.cn/share/files/1',
            'status' => 1,
            'sort' => 100,
            'base_usage_count' => 0,
            'actual_usage_count' => 0,
            'total_usage_count' => 0,
            'created_uid' => 'user-1',
            'updated_uid' => 'user-2',
        ], $entity->toArray());
    }
}

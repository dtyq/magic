<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\SuperMagic\Skill;

use App\Application\SuperMagic\Skill\Service\AdminSkillCategoryAppService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\SuperMagic\Agent\Entity\AgentVersionEntity;
use App\Domain\SuperMagic\Skill\Entity\SkillCategoryEntity;
use App\Domain\SuperMagic\Skill\Entity\SkillEntity;
use App\Domain\SuperMagic\Skill\Entity\SkillMarketEntity;
use App\Domain\SuperMagic\Skill\Entity\SkillVersionEntity;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\Query\SkillQuery;
use App\Domain\SuperMagic\Skill\Service\SkillCategoryDomainService;
use App\Infrastructure\Util\Context\CoContext;
use App\Interfaces\SuperMagic\Agent\Assembler\SuperMagicAgentAssembler;
use App\Interfaces\SuperMagic\Skill\Assembler\SkillAssembler;
use App\Interfaces\SuperMagic\Skill\DTO\Request\CreateSkillCategoryRequestAdminDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\PublishSkillRequestDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\QuerySkillCategoriesRequestAdminDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\UpdateSkillCategoryRequestAdminDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\UpdateSkillMarketRequestAdminDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\OrganizationInfoAdminDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\PublisherInfoAdminDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\SkillMarketListItemAdminDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\SkillMarketListItemDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\SkillMarketListResponseDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\SkillPublishPrefillResponseDTO;
use App\Interfaces\SuperMagic\Skill\FormRequest\SkillQueryFormRequest;
use Hyperf\Codec\Packer\PhpSerializerPacker;
use Hyperf\Context\ApplicationContext;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionClass;
use ReflectionMethod;
use RuntimeException;

/**
 * @internal
 */
final class SkillMarketCategoryContractTest extends TestCase
{
    public static function setUpBeforeClass(): void
    {
        if (! ApplicationContext::hasContainer()) {
            ApplicationContext::setContainer(new class implements ContainerInterface {
                public function get(string $id)
                {
                    return match ($id) {
                        PhpSerializerPacker::class => new PhpSerializerPacker(),
                        default => throw new RuntimeException('Unsupported service: ' . $id),
                    };
                }

                public function has(string $id): bool
                {
                    return $id === PhpSerializerPacker::class;
                }
            });
        }
    }

    public function testPublishRequestAcceptsAtMostOneHundredCategoriesOnlyForMarket(): void
    {
        $method = new ReflectionMethod(PublishSkillRequestDTO::class, 'getHyperfValidationRules');
        $method->setAccessible(true);
        $rules = $method->invoke(null);

        $this->assertSame(
            'exclude_unless:publish_target_type,MARKET|nullable|array|max:100',
            $rules['category_ids']
        );
        $this->assertSame('integer|min:1', $rules['category_ids.*']);
    }

    public function testMarketQueryAcceptsStringCategoryIds(): void
    {
        $request = (new ReflectionClass(SkillQueryFormRequest::class))->newInstanceWithoutConstructor();

        $this->assertSame('nullable|array', $request->rules()['category_ids']);
        $this->assertSame('string', $request->rules()['category_ids.*']);
        $this->assertArrayHasKey('category_ids.*.string', $request->messages());
        $this->assertArrayNotHasKey('category_ids.*.regex', $request->messages());
    }

    public function testMarketQueryNormalizesStringCategoryIdsToIntegers(): void
    {
        $query = new SkillQuery(['category_ids' => ['10001', '10002']]);

        $this->assertSame([10001, 10002], $query->getCategoryIds());
    }

    public function testMarketQueryAcceptsFeaturedFilter(): void
    {
        $request = (new ReflectionClass(SkillQueryFormRequest::class))->newInstanceWithoutConstructor();
        $this->assertSame('nullable|boolean', $request->rules()['is_featured']);
        $this->assertArrayHasKey('is_featured.boolean', $request->messages());

        $query = new SkillQuery([]);
        $this->assertNull($query->getIsFeatured());

        $query = new SkillQuery(['is_featured' => '0']);
        $this->assertFalse($query->getIsFeatured());

        $query = new SkillQuery(['is_featured' => '1']);
        $this->assertTrue($query->getIsFeatured());

        $query = new SkillQuery(['is_featured' => 0]);
        $this->assertFalse($query->getIsFeatured());

        $query = new SkillQuery(['is_featured' => 1]);
        $this->assertTrue($query->getIsFeatured());

        $query = new SkillQuery(['is_featured' => true]);
        $this->assertTrue($query->getIsFeatured());

        $query = new SkillQuery(['is_featured' => false]);
        $this->assertFalse($query->getIsFeatured());
    }

    public function testFeaturedResponseSerializesPagination(): void
    {
        $response = new SkillMarketListResponseDTO([], 1, 10, 17);

        $this->assertSame([
            'list' => [],
            'page' => 1,
            'page_size' => 10,
            'total' => 17,
        ], $response->jsonSerialize());
    }

    public function testMarketQueryResponseOmitsTotalWhenNotRequested(): void
    {
        $response = new SkillMarketListResponseDTO([], 1, 10);

        $this->assertSame([
            'list' => [],
            'page' => 1,
            'page_size' => 10,
        ], $response->jsonSerialize());
    }

    public function testMarketDetailResolvesI18nWithLanguageAndDefaultFallback(): void
    {
        CoContext::setLanguage('zh_CN');
        $market = new SkillMarketEntity([
            'skill_code' => 'skill-code',
            'name_i18n' => [],
            'description_i18n' => [],
            'publisher_id' => 'publisher',
        ]);
        $version = new SkillVersionEntity([
            'code' => 'skill-code',
            'version' => '1.0.0',
            'package_name' => 'package',
            'name_i18n' => [
                'default' => 'Default name',
                'zh_CN' => '中文名称',
            ],
            'description_i18n' => [
                'default' => 'Default description',
                'zh_CN' => '中文描述',
            ],
            'source_i18n' => [
                'default' => 'Default source',
                'zh_CN' => '中文来源',
            ],
        ]);

        $this->assertSame('中文名称', $version->getI18nName('zh_CN'));
        $this->assertSame('Default name', $version->getI18nName('en_US'));
        $this->assertSame('中文描述', $version->getI18nDescription('zh_CN'));
        $this->assertSame('Default description', $version->getI18nDescription('en_US'));

        $payload = SkillAssembler::createMarketDetailResponseDTO($market, $version, false, false, null, '')->jsonSerialize();
        $this->assertSame('中文名称', $payload['name']);
        $this->assertSame('中文描述', $payload['description']);
        $this->assertSame('中文来源', $payload['source']);

        CoContext::setLanguage('en_US');
        $payload = SkillAssembler::createMarketDetailResponseDTO($market, $version, false, false, null, '')->jsonSerialize();
        $this->assertSame('Default name', $payload['name']);
        $this->assertSame('Default description', $payload['description']);
        $this->assertSame('Default source', $payload['source']);
    }

    public function testMarketDetailPrefersMarketSnapshotI18nOverVersion(): void
    {
        CoContext::setLanguage('zh_CN');
        $market = new SkillMarketEntity([
            'skill_code' => 'skill-code',
            'publisher_id' => 'publisher',
            'name_i18n' => [
                'default' => 'Market default name',
                'zh_CN' => '市场名称',
            ],
            'description_i18n' => [
                'default' => 'Market default description',
                'zh_CN' => '市场描述',
            ],
        ]);
        $version = new SkillVersionEntity([
            'code' => 'skill-code',
            'version' => '1.0.0',
            'package_name' => 'package',
            'name_i18n' => [
                'default' => 'Version default name',
                'zh_CN' => '版本名称',
            ],
            'description_i18n' => [
                'default' => 'Version default description',
                'zh_CN' => '版本描述',
            ],
            'source_i18n' => [
                'default' => 'Version source',
                'zh_CN' => '版本来源',
            ],
        ]);

        $payload = SkillAssembler::createMarketDetailResponseDTO($market, $version, false, false, null, '')->jsonSerialize();

        $this->assertSame('市场名称', $payload['name']);
        $this->assertSame('市场描述', $payload['description']);
        $this->assertSame('版本来源', $payload['source']);
        $this->assertSame($market->getNameI18n(), $payload['name_i18n']);
        $this->assertSame($market->getDescriptionI18n(), $payload['description_i18n']);
        $this->assertSame($version->getSourceI18n(), $payload['source_i18n']);

        CoContext::setLanguage('en_US');
        $payload = SkillAssembler::createMarketDetailResponseDTO($market, $version, false, false, null, '')->jsonSerialize();

        $this->assertSame('Market default name', $payload['name']);
        $this->assertSame('Market default description', $payload['description']);
        $this->assertSame('Version source', $payload['source']);
    }

    public function testI18nGettersCoerceNonStringValuesToDefault(): void
    {
        $version = new SkillVersionEntity([
            'code' => 'skill-code',
            'version' => '1.0.0',
            'package_name' => 'package',
            'name_i18n' => [
                'zh_CN' => 123,
                'default' => 'Default name',
            ],
            'description_i18n' => [
                'zh_CN' => null,
                'default' => 'Default description',
            ],
            'source_i18n' => [
                'zh_CN' => [],
                'default' => 'Default source',
            ],
        ]);

        $this->assertSame('Default name', $version->getI18nName('zh_CN'));
        $this->assertSame('Default description', $version->getI18nDescription('zh_CN'));
        $this->assertSame('Default source', $version->getI18nSource('zh_CN'));
    }

    public function testMarketListItemUsesPassedLanguageWithoutReadingContext(): void
    {
        CoContext::setLanguage('zh_CN');
        $market = new SkillMarketEntity([
            'organization_code' => 'org',
            'skill_code' => 'skill-code',
            'skill_version_id' => 1,
            'publisher_id' => 'publisher',
            'name_i18n' => [
                'default' => 'Default name',
                'en_US' => 'English name',
            ],
            'description_i18n' => [
                'default' => 'Default description',
                'en_US' => 'English description',
            ],
        ]);
        $version = new SkillVersionEntity([
            'code' => 'skill-code',
            'version' => '1.0.0',
            'package_name' => 'package',
            'source_i18n' => [
                'default' => 'Default source',
                'en_US' => 'English source',
            ],
        ]);

        $payload = SkillAssembler::createMarketListItemDTO($market, version: $version, language: 'en_US')->jsonSerialize();

        $this->assertSame('English name', $payload['name']);
        $this->assertSame('English description', $payload['description']);
        $this->assertSame('English source', $payload['source']);
        $this->assertArrayNotHasKey('name_i18n', $payload);
        $this->assertArrayNotHasKey('description_i18n', $payload);
        $this->assertArrayNotHasKey('source_i18n', $payload);
    }

    public function testMarketInstalledListItemResolvesI18nWithDefaultFallback(): void
    {
        $version = new SkillVersionEntity([
            'code' => 'skill-code',
            'creator_id' => 'creator',
            'version' => '1.0.0',
            'package_name' => 'package',
            'name_i18n' => [
                'default' => 'Default name',
                'zh_CN' => '中文名称',
            ],
            'description_i18n' => [
                'default' => 'Default description',
                'zh_CN' => '中文描述',
            ],
            'source_i18n' => [
                'default' => 'Default source',
                'zh_CN' => '中文来源',
            ],
        ]);

        CoContext::setLanguage('zh_CN');
        $payload = SkillAssembler::createListItemDTOFromVersion($version, 'MARKET')->jsonSerialize();
        $this->assertSame('中文名称', $payload['name']);
        $this->assertSame('中文描述', $payload['description']);
        $this->assertSame('中文来源', $payload['source']);

        CoContext::setLanguage('en_US');
        $payload = SkillAssembler::createListItemDTOFromVersion($version, 'MARKET')->jsonSerialize();
        $this->assertSame('Default name', $payload['name']);
        $this->assertSame('Default description', $payload['description']);
        $this->assertSame('Default source', $payload['source']);
    }

    public function testUpdateMarketRequestDoesNotExposeSingleCategoryId(): void
    {
        $reflection = new ReflectionClass(UpdateSkillMarketRequestAdminDTO::class);

        $this->assertFalse($reflection->hasProperty('categoryId'));
        $this->assertFalse($reflection->hasMethod('setCategoryId'));
        $this->assertArrayNotHasKey('category_id', $this->getValidationRules(UpdateSkillMarketRequestAdminDTO::class));
    }

    public function testUpdateMarketRequestCanClearAllCategories(): void
    {
        $dto = new UpdateSkillMarketRequestAdminDTO();
        $dto->setCategoryIds([]);

        $this->assertSame(['category_ids' => []], $dto->getUpdatePayload());
        $this->assertTrue($dto->hasUpdates());
    }

    public function testSkillMarketEntitySerializesCategoryIdsWithoutCategoryId(): void
    {
        $entity = new SkillMarketEntity([
            'id' => 1,
            'organizationCode' => 'org-code',
            'skillCode' => 'skill-code',
            'skillVersionId' => 2,
            'publisherId' => 'user-id',
            'categoryIds' => [10, 20],
        ]);

        $payload = $entity->toArray();

        $this->assertSame([10, 20], $payload['category_ids']);
        $this->assertArrayNotHasKey('category_id', $payload);
    }

    public function testAdminMarketResponseUsesCategoryIdsWithoutCategoryId(): void
    {
        $payload = (new SkillMarketListItemAdminDTO(
            id: '1',
            organization: new OrganizationInfoAdminDTO('org', 'Org'),
            skillCode: 'skill-code',
            skillVersionId: '2',
            packageName: 'package',
            nameI18n: [],
            descriptionI18n: [],
            logo: null,
            publisherId: 'user',
            publisherType: 'USER',
            categoryIds: [10, 20],
            publishStatus: 'PUBLISHED',
            installCount: 0,
            sortOrder: null,
            isFeatured: false,
            isHidden: false,
            publisher: PublisherInfoAdminDTO::empty(),
            createdAt: null,
            updatedAt: null,
        ))->toArray();

        $this->assertSame(['10', '20'], $payload['category_ids']);
        $this->assertArrayNotHasKey('category_id', $payload);
    }

    public function testPublishPrefillResponseExposesLocalizedDescriptionAndLegacyI18nDescription(): void
    {
        $payload = (new SkillPublishPrefillResponseDTO(
            version: '1.0.0',
            description: 'Description',
            versionDescriptionI18n: ['default' => 'Description'],
            publishTargetType: null,
            publishTargetValue: null,
        ))->toArray();

        $this->assertSame('Description', $payload['description']);
        $this->assertSame(['default' => 'Description'], $payload['version_description_i18n']);
    }

    public function testPublicCategoryTreeReturnsLocalizedNamesWithoutI18nPayloadAtEveryLevel(): void
    {
        $parent = (new SkillCategoryEntity())
            ->setId(10)
            ->setNameI18n(['default' => 'Parent default', 'en_US' => 'Parent']);
        $child = (new SkillCategoryEntity())
            ->setId(20)
            ->setParentId(10)
            ->setNameI18n(['default' => 'Child default', 'en_US' => 'Child']);

        $categoryDomainService = $this->createMock(SkillCategoryDomainService::class);
        $categoryDomainService->method('findByQuery')->willReturn([$parent, $child]);
        $categoryDomainService->method('getVisiblePublishedMarketIdsMap')->willReturn([10 => [], 20 => []]);

        CoContext::setLanguage('en_US');
        $tree = (new AdminSkillCategoryAppService(
            $categoryDomainService,
            $this->createMock(MagicUserDomainService::class),
        ))->getPublicTree(true);

        $this->assertSame('Parent', $tree[0]['name']);
        $this->assertArrayNotHasKey('name_i18n', $tree[0]);
        $this->assertSame('Child', $tree[0]['children'][0]['name']);
        $this->assertArrayNotHasKey('name_i18n', $tree[0]['children'][0]);
    }

    public function testSkillCategoryResolvesLocalizedNameWithDefaultFallback(): void
    {
        $category = (new SkillCategoryEntity())->setNameI18n([
            'default' => 'Default category',
            'zh_CN' => '中文分类',
        ]);

        $this->assertSame('中文分类', $category->getI18nName('zh_CN'));
        $this->assertSame('Default category', $category->getI18nName('en_US'));
    }

    public function testSkillCategoryParentIdUsesStringForRequestsAndResponses(): void
    {
        $createRules = $this->getValidationRules(CreateSkillCategoryRequestAdminDTO::class);
        $updateRules = $this->getValidationRules(UpdateSkillCategoryRequestAdminDTO::class);

        $this->assertSame('sometimes|string|regex:/^\d+$/', $createRules['parent_id']);
        $this->assertSame('sometimes|string|regex:/^\d+$/', $updateRules['parent_id']);

        $update = new UpdateSkillCategoryRequestAdminDTO();
        $update->setParentId('10');
        $this->assertSame(['parent_id' => '10'], $update->getUpdatePayload());

        $parent = (new SkillCategoryEntity())
            ->setId(10)
            ->setParentId('0')
            ->setNameI18n(['default' => 'Parent']);
        $child = (new SkillCategoryEntity())
            ->setId(20)
            ->setParentId('10')
            ->setNameI18n(['default' => 'Child']);

        $categoryDomainService = $this->createMock(SkillCategoryDomainService::class);
        $categoryDomainService->method('findByQuery')->willReturn([$parent, $child]);
        $categoryDomainService->method('getMarketIdsMap')->willReturn([10 => [], 20 => []]);

        $tree = (new AdminSkillCategoryAppService(
            $categoryDomainService,
            $this->createMock(MagicUserDomainService::class),
        ))->query(new QuerySkillCategoriesRequestAdminDTO());

        $this->assertSame('0', $tree[0]['parent_id']);
        $this->assertSame('10', $tree[0]['children'][0]['parent_id']);
    }

    public function testMarketListResponseUsesResolvedFieldsWithoutLegacyI18nFields(): void
    {
        $payload = (new SkillMarketListItemDTO(
            id: 1,
            skillCode: 'skill-code',
            userSkillCode: 'skill-code',
            name: 'Skill name',
            description: 'Skill description',
            source: 'Skill source',
            logo: '',
            publisherType: 'OFFICIAL',
            publisher: [],
            publishStatus: 'PUBLISHED',
            isAdded: false,
            needUpgrade: false,
            isCreator: false,
            isFeatured: false,
            createdAt: '',
            updatedAt: '',
            fileKey: 'temp/skills/example.zip',
            fileUrl: 'https://example.com/skill.zip',
            installCount: 42,
        ))->jsonSerialize();

        $this->assertSame('Skill name', $payload['name']);
        $this->assertSame('Skill description', $payload['description']);
        $this->assertSame('Skill source', $payload['source']);
        $this->assertArrayNotHasKey('name_i18n', $payload);
        $this->assertArrayNotHasKey('description_i18n', $payload);
        $this->assertArrayNotHasKey('source_i18n', $payload);
        $this->assertSame(42, $payload['install_count']);
        $this->assertSame('temp/skills/example.zip', $payload['file_key']);
        $this->assertSame('https://example.com/skill.zip', $payload['file_url']);
        $this->assertArrayNotHasKey('category_ids', $payload);
    }

    public function testUserSkillListResponseUsesResolvedFieldsWithoutLegacyI18nFields(): void
    {
        CoContext::setLanguage('zh_CN');
        $skill = new SkillEntity([
            'code' => 'skill-code',
            'name_i18n' => ['default' => 'Default name', 'zh_CN' => '中文名称'],
            'description_i18n' => ['default' => 'Default description', 'zh_CN' => '中文描述'],
            'source_i18n' => ['default' => 'Default source', 'zh_CN' => '中文来源'],
        ]);

        $payload = SkillAssembler::createListItemDTO($skill)->jsonSerialize();

        $this->assertSame('中文名称', $payload['name']);
        $this->assertSame('中文描述', $payload['description']);
        $this->assertSame('中文来源', $payload['source']);
        $this->assertArrayNotHasKey('name_i18n', $payload);
        $this->assertArrayNotHasKey('description_i18n', $payload);
        $this->assertArrayNotHasKey('source_i18n', $payload);
    }

    public function testSkillVersionResponseExposesLocalizedDescriptionAndCategories(): void
    {
        CoContext::setLanguage('zh_CN');
        $version = new SkillVersionEntity([
            'id' => 1,
            'version' => '1.0.0',
            'publish_status' => 'PUBLISHED',
            'review_status' => 'APPROVED',
            'publish_target_type' => 'MARKET',
            'version_description_i18n' => [
                'default' => 'Default description',
                'zh_CN' => '中文描述',
            ],
            'category_ids' => [10, 20],
        ]);
        $categories = [
            10 => (new SkillCategoryEntity())->setId(10)->setNameI18n(['default' => 'Default category', 'zh_CN' => '营销场景']),
            20 => (new SkillCategoryEntity())->setId(20)->setNameI18n(['default' => 'Default HR', 'zh_CN' => '人力资源']),
        ];

        $payload = SkillAssembler::createQuerySkillVersionsResponseDTO(
            versions: [$version],
            userMap: [],
            page: 1,
            pageSize: 10,
            total: 1,
            categoryMap: $categories,
        )->toArray();

        $this->assertSame('中文描述', $payload['list'][0]['version_description']);
        $this->assertSame([
            ['id' => '10', 'name' => '营销场景'],
            ['id' => '20', 'name' => '人力资源'],
        ], $payload['list'][0]['categories']);
        $this->assertSame($version->getVersionDescriptionI18n(), $payload['list'][0]['version_description_i18n']);
    }

    public function testAgentVersionResponseExposesLocalizedDescription(): void
    {
        CoContext::setLanguage('zh_CN');
        $version = new AgentVersionEntity([
            'id' => 1,
            'version' => '1.0.0',
            'publish_status' => 'PUBLISHED',
            'review_status' => 'APPROVED',
            'publish_target_type' => 'MARKET',
            'version_description_i18n' => [
                'default' => 'Default description',
                'zh_CN' => '中文描述',
            ],
        ]);

        $payload = SuperMagicAgentAssembler::createQueryAgentVersionsResponseDTO(
            versions: [$version],
            userMap: [],
            page: 1,
            pageSize: 10,
            total: 1,
        )->toArray();

        $this->assertSame('中文描述', $payload['list'][0]['version_description']);
        $this->assertSame($version->getVersionDescriptionI18n(), $payload['list'][0]['version_description_i18n']);
    }

    /**
     * @param class-string $dtoClass
     * @return array<string, mixed>
     */
    private function getValidationRules(string $dtoClass): array
    {
        $method = new ReflectionMethod($dtoClass, 'getHyperfValidationRules');
        $method->setAccessible(true);

        return $method->invoke(null);
    }
}

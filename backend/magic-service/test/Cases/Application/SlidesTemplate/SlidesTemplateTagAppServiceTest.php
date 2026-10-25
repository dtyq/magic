<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Application\SlidesTemplate;

use App\Application\SlidesTemplate\Service\AdminSlidesTemplateTagAppService;
use App\Application\SlidesTemplate\Service\SlidesTemplateTagAppService;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateDataIsolation;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateTagEntity;
use App\Domain\SlidesTemplate\Service\SlidesTemplateTagDomainService;
use App\Interfaces\SlidesTemplate\Assembler\SlidesTemplateTagAssembler;
use App\Interfaces\SlidesTemplate\DTO\Request\PublicQuerySlidesTemplateTagRequest;
use Hyperf\Codec\Packer\PhpSerializerPacker;
use Hyperf\Context\ApplicationContext;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionClass;
use RuntimeException;

/**
 * @internal
 */
class SlidesTemplateTagAppServiceTest extends TestCase
{
    private static bool $hadOriginalContainer = false;

    private static ?ContainerInterface $originalContainer = null;

    public static function setUpBeforeClass(): void
    {
        self::$hadOriginalContainer = ApplicationContext::hasContainer();
        self::$originalContainer = self::$hadOriginalContainer ? ApplicationContext::getContainer() : null;

        ApplicationContext::setContainer(new class implements ContainerInterface {
            public function get(string $id): mixed
            {
                if ($id === PhpSerializerPacker::class) {
                    return new PhpSerializerPacker();
                }

                throw new RuntimeException('Unexpected container dependency: ' . $id);
            }

            public function has(string $id): bool
            {
                return $id === PhpSerializerPacker::class;
            }

            public function make(string $name, array $parameters = []): mixed
            {
                return $this->get($name);
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

    public function testQueriesGroupsUseCurrentAndOfficialVisibleTagsByCategory(): void
    {
        $dataIsolation = $this->makeDataIsolation('CURRENT_ORG', ['OFFICIAL_ORG']);
        $request = new TestPublicQuerySlidesTemplateTagGroupsRequest(categoryCode: 'PPT-CATE-work');

        $group = new SlidesTemplateTagEntity();
        $group->setId(1)
            ->setOrganizationCode('OFFICIAL_ORG')
            ->setParentId(0)
            ->setNodeType('group')
            ->setCode('purpose_group')
            ->setNameI18n(['zh_CN' => '用途与交付物', 'en_US' => 'Purpose']);

        $domainService = $this->createMock(SlidesTemplateTagDomainService::class);
        $domainService
            ->expects($this->once())
            ->method('queriesCachedVisibleGroupsWithTagsByCategory')
            ->with(
                $this->callback(static fn (SlidesTemplateDataIsolation $actual): bool => $actual->isContainOfficialOrganization()
                    && $actual->getOrganizationCodes() === ['CURRENT_ORG', 'OFFICIAL_ORG']),
                'PPT-CATE-work'
            )
            ->willReturn([$group]);

        $service = new SlidesTemplateTagAppService($domainService);
        $this->assertSame([$group], $service->queriesGroups($dataIsolation, $request));
    }

    public function testAdminTagItemDoesNotExposeRemovedTagFields(): void
    {
        $tag = new SlidesTemplateTagEntity();
        $tag->setId(1)
            ->setOrganizationCode('OFFICIAL_ORG')
            ->setParentId(0)
            ->setNodeType('group')
            ->setCode('purpose_group')
            ->setNameI18n(['zh_CN' => '用途与交付物', 'en_US' => 'Purpose']);

        $data = SlidesTemplateTagAssembler::createAdminItemDTO($tag)->toArray();

        $this->assertArrayNotHasKey('usage_type', $data);
        $this->assertArrayNotHasKey('is_visible', $data);
        $this->assertArrayNotHasKey('aliases_i18n', $data);
    }

    public function testAdminTreeReturnsOfficialOrganizationTagTree(): void
    {
        $dataIsolation = $this->makeDataIsolation('OFFICIAL_ORG', ['OFFICIAL_ORG']);
        $group = new SlidesTemplateTagEntity();
        $group->setId(1)
            ->setOrganizationCode('OFFICIAL_ORG')
            ->setParentId(0)
            ->setNodeType('group')
            ->setCode('purpose_group')
            ->setNameI18n(['zh_CN' => '用途与交付物', 'en_US' => 'Purpose']);

        $tag = new SlidesTemplateTagEntity();
        $tag->setId(2)
            ->setOrganizationCode('OFFICIAL_ORG')
            ->setParentId(1)
            ->setNodeType('tag')
            ->setCode('purpose-annual-report')
            ->setNameI18n(['zh_CN' => '年度报告', 'en_US' => 'Annual Report']);
        $group->setChildren([$tag]);

        $domainService = $this->createMock(SlidesTemplateTagDomainService::class);
        $domainService
            ->expects($this->once())
            ->method('queriesTree')
            ->with($this->callback(static fn (SlidesTemplateDataIsolation $actual): bool => $actual->getCurrentOrganizationCode() === 'OFFICIAL_ORG'))
            ->willReturn([$group]);

        $service = new AdminSlidesTemplateTagAppService($domainService);

        $this->assertSame([$group], $service->tree($dataIsolation));
    }

    public function testAdminTreeDoesNotExposeTemplateCount(): void
    {
        $group = new SlidesTemplateTagEntity();
        $group->setId(1)
            ->setOrganizationCode('OFFICIAL_ORG')
            ->setParentId(0)
            ->setNodeType('group')
            ->setCode('purpose_group')
            ->setNameI18n(['zh_CN' => '用途与交付物', 'en_US' => 'Purpose']);

        $tag = new SlidesTemplateTagEntity();
        $tag->setId(2)
            ->setOrganizationCode('OFFICIAL_ORG')
            ->setParentId(1)
            ->setNodeType('tag')
            ->setCode('purpose-annual-report')
            ->setNameI18n(['zh_CN' => '年度报告', 'en_US' => 'Annual Report']);
        $group->setChildren([$tag]);

        $tree = SlidesTemplateTagAssembler::createAdminTreeDTO([$group]);

        $this->assertArrayNotHasKey('template_count', $tree[0]);
        $this->assertArrayNotHasKey('template_count', $tree[0]['children'][0]);
    }

    public function testOfficialTagVocabularyDoesNotContainDetailNodes(): void
    {
        $file = dirname(__DIR__, 4) . '/storage/slides-template/tag-vocabulary/slides_template_tag_vocabulary.json';
        $vocabulary = json_decode((string) file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);

        foreach ($vocabulary['groups'] as $group) {
            $this->assertStringNotContainsString('detail', (string) $group['code']);
        }

        foreach ($vocabulary['tags'] as $tag) {
            $code = (string) $tag['code'];
            $this->assertFalse(str_starts_with($code, 'detail-'), sprintf('Detail tag should be removed: %s', $code));
            $this->assertNotSame('detail', $tag['usage_type'] ?? null, sprintf('Detail tag should be removed: %s', $code));
        }
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

class TestPublicQuerySlidesTemplateTagGroupsRequest extends PublicQuerySlidesTemplateTagRequest
{
    public function __construct(
        private readonly ?string $categoryCode = null,
    ) {
    }

    public function getCategoryCode(): ?string
    {
        return $this->categoryCode;
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperMagic\Skill;

use App\Domain\SuperMagic\Skill\Entity\SkillMarketEntity;
use App\Interfaces\SuperMagic\Skill\Assembler\SkillAssembler;
use App\Interfaces\SuperMagic\Skill\DTO\Response\SkillMarketListItemDTO;
use Hyperf\Codec\Packer\PhpSerializerPacker;
use Hyperf\Context\ApplicationContext;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use RuntimeException;

/** @internal */
final class SkillMarketSortContractTest extends TestCase
{
    /**
     * 被替换掉的原始容器，tearDownAfterClass 时还回去。
     *
     * 这里替换的是进程级的 ApplicationContext。不还原的话，同一进程里后续每个测试
     * 都会拿到这个桩容器：它对除 PhpSerializerPacker 以外的任何服务都抛
     * "Unsupported service"，于是任何需要 ConfigurationInterface 的代码路径
     * （例如 ExceptionBuilder 读 config('error_message')）都会直接炸掉。
     * 套件里确实有测试因此挂掉 —— 修复方式就是还回去。
     */
    private static ?ContainerInterface $originalContainer = null;

    public static function setUpBeforeClass(): void
    {
        self::$originalContainer = ApplicationContext::hasContainer()
            ? ApplicationContext::getContainer()
            : null;

        ApplicationContext::setContainer(new class implements ContainerInterface {
            public function get(string $id): mixed
            {
                if ($id === PhpSerializerPacker::class) {
                    return new PhpSerializerPacker();
                }

                throw new RuntimeException('Unsupported service: ' . $id);
            }

            public function has(string $id): bool
            {
                return $id === PhpSerializerPacker::class;
            }
        });
    }

    public static function tearDownAfterClass(): void
    {
        if (self::$originalContainer !== null) {
            ApplicationContext::setContainer(self::$originalContainer);
            self::$originalContainer = null;
        }

        parent::tearDownAfterClass();
    }

    public function testMarketEntityExposesPersistedTotalInstallCount(): void
    {
        $market = new SkillMarketEntity([
            'id' => 7,
            'organization_code' => 'org',
            'skill_version_id' => 1,
            'skill_code' => 'skill-7',
            'publisher_id' => 'publisher-7',
            'install_count' => 2,
            'base_install_count' => 3,
            'total_install_count' => 5,
        ]);

        $this->assertSame(5, $market->getTotalInstallCount());
        $this->assertSame(5, $market->toArray()['total_install_count']);
    }

    public function testMarketListResponseContainsTotalInstallCountAndKeepsInstallCount(): void
    {
        $market = new SkillMarketEntity([
            'id' => 7,
            'organization_code' => 'org',
            'skill_version_id' => 1,
            'skill_code' => 'skill-7',
            'publisher_id' => 'publisher-7',
            'install_count' => 2,
            'base_install_count' => 3,
            'total_install_count' => 5,
        ]);

        $payload = SkillAssembler::createMarketListItemDTO($market)->jsonSerialize();

        $this->assertSame(5, $payload['install_count']);
        self::assertArrayNotHasKey('total_install_count', $payload);
    }

    public function testRepositoryUsesTotalInstallCountInPublicMarketOrdering(): void
    {
        $repositoryPath = dirname(__DIR__, 5) . '/app/Domain/SuperMagic/Skill/Repository/Persistence/SkillMarketRepository.php';
        $source = file_get_contents($repositoryPath);

        self::assertIsString($source);
        self::assertStringContainsString("orderBy('total_install_count', 'DESC')", $source);
    }

    public function testRepositoryUpdatesBothInstallCountersInOneStatement(): void
    {
        $repositoryPath = dirname(__DIR__, 5) . '/app/Domain/SuperMagic/Skill/Repository/Persistence/SkillMarketRepository.php';
        $source = file_get_contents($repositoryPath);

        self::assertIsString($source);
        self::assertStringContainsString("'install_count' => Db::raw('install_count + 1')", $source);
        self::assertStringContainsString("'total_install_count' => Db::raw('total_install_count + 1')", $source);
        self::assertStringContainsString("'total_install_count' => Db::raw('install_count + '", $source);
    }

    public function testMigrationBackfillsTotalInstallCountAndExtendsTheBusinessIndex(): void
    {
        $migrationPath = dirname(__DIR__, 5) . '/migrations/2026_08_28_120000_add_total_install_count_to_magic_skill_market_table.php';
        $source = file_get_contents($migrationPath);

        self::assertIsString($source);
        self::assertStringContainsString('SET total_install_count = install_count + base_install_count', $source);
        self::assertStringContainsString("['is_featured', 'sort_order', 'total_install_count', 'id']", $source);
    }

    public function testInstallDispatchesVectorPayloadRefreshAfterCommit(): void
    {
        $servicePath = dirname(__DIR__, 5) . '/app/Application/SuperMagic/Skill/Service/SkillAppService.php';
        $source = file_get_contents($servicePath);

        self::assertIsString($source);
        $commitPosition = strpos($source, 'Db::commit();', strpos($source, 'function addSkillFromStore'));
        $eventPosition = strpos($source, 'new SkillMarketInstalledEvent(', $commitPosition ?: 0);

        self::assertIsInt($commitPosition);
        self::assertIsInt($eventPosition);
        self::assertGreaterThan($commitPosition, $eventPosition);
    }

    public function testVectorSyncSubscriberListensForSkillMarketInstalledEvent(): void
    {
        $subscriberPath = dirname(__DIR__, 5) . '/app/Application/SuperMagic/Skill/Event/Subscribe/SkillMarketVectorIndexSyncSubscriber.php';
        $source = file_get_contents($subscriberPath);

        self::assertIsString($source);
        self::assertStringContainsString('SkillMarketInstalledEvent::class', $source);
        self::assertStringContainsString('instanceof SkillMarketInstalledEvent', $source);
    }

    public function testSkillFileUrlRequestsUseTheSameServiceMethod(): void
    {
        $servicePath = dirname(__DIR__, 5) . '/app/Application/SuperMagic/Skill/Service/SkillAppService.php';
        $sandboxApiPath = dirname(__DIR__, 5) . '/app/Interfaces/SuperMagic/Agent/Facade/Sandbox/SkillSandboxApi.php';
        $skillApiPath = dirname(__DIR__, 5) . '/app/Interfaces/SuperMagic/Skill/Facade/SkillApi.php';

        $serviceSource = file_get_contents($servicePath);
        $sandboxApiSource = file_get_contents($sandboxApiPath);
        $skillApiSource = file_get_contents($skillApiPath);

        self::assertIsString($serviceSource);
        self::assertIsString($sandboxApiSource);
        self::assertIsString($skillApiSource);
        self::assertStringContainsString('public function getSkillFileUrlsByIds(', $serviceSource);
        self::assertStringNotContainsString('bool $recordUsage', $serviceSource);
        self::assertStringContainsString('getSkillFileUrlsByIds($requestContext, $requestDTO)', $sandboxApiSource);
        self::assertStringContainsString('new SkillUsedEvent(', $serviceSource);
        self::assertStringNotContainsString('new SkillMarketUsedEvent(', $serviceSource);
        self::assertStringNotContainsString('if ($recordUsage)', $serviceSource);
        self::assertStringContainsString('getSkillFileUrlsByIds($requestContext, $requestDTO)', $skillApiSource);
        self::assertStringNotContainsString('getSkillFileUrlsByIds($requestContext, $requestDTO,', $skillApiSource);
    }

    public function testLatestPublishedSkillVersionsUsesRenamedServiceMethodAndTracksUsage(): void
    {
        $servicePath = dirname(__DIR__, 5) . '/app/Application/SuperMagic/Skill/Service/SkillAppService.php';
        $skillApiPath = dirname(__DIR__, 5) . '/app/Interfaces/SuperMagic/Skill/Facade/SkillApi.php';
        $sandboxApiPath = dirname(__DIR__, 5) . '/app/Interfaces/SuperMagic/Agent/Facade/Sandbox/SkillSandboxApi.php';

        $serviceSource = file_get_contents($servicePath);
        $skillApiSource = file_get_contents($skillApiPath);
        $sandboxApiSource = file_get_contents($sandboxApiPath);

        self::assertIsString($serviceSource);
        self::assertIsString($skillApiSource);
        self::assertIsString($sandboxApiSource);
        self::assertStringContainsString('public function getLatestPublishedSkillVersions(', $serviceSource);
        self::assertStringNotContainsString('public function getLatestPublishedVersionsByCodes(', $serviceSource);
        self::assertStringContainsString('getLatestPublishedSkillVersions($requestContext, $requestDTO)', $skillApiSource);
        self::assertStringContainsString('getLatestPublishedSkillVersions($requestContext, $requestDTO)', $sandboxApiSource);
        self::assertStringContainsString('new SkillUsedEvent(', $serviceSource);
    }

    public function testDtoConstructorRemainsCompatibleWithExistingInstallCountArgument(): void
    {
        $dto = new SkillMarketListItemDTO(
            1,
            'skill',
            'skill',
            'name',
            'description',
            'source',
            '',
            'USER',
            [],
            'PUBLISHED',
            false,
            false,
            false,
            false,
            '',
            '',
            '',
            null,
            '',
            '',
            42,
        );

        self::assertSame(42, $dto->jsonSerialize()['install_count']);
    }
}

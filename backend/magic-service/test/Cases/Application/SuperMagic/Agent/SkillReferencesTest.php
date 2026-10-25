<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Agent;

use App\Application\SuperMagic\Agent\Parser\AgentZipParser;
use App\Application\SuperMagic\Agent\Service\SkillsMdSyncService;
use App\Application\SuperMagic\Agent\Service\SuperMagicAgentAppService;
use App\Application\SuperMagic\Skill\Service\SkillAppService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\SuperMagic\Agent\Entity\AgentSkillEntity;
use App\Domain\SuperMagic\Agent\Entity\AgentVersionEntity;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use App\Domain\SuperMagic\Agent\Service\SuperMagicAgentSkillDomainService;
use App\Domain\SuperMagic\Agent\Service\SuperMagicAgentVersionDomainService;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Skill\Entity\SkillVersionEntity;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillDataIsolation;
use App\Domain\SuperMagic\Skill\Service\SkillVersionDomainService;
use App\Infrastructure\SuperMagic\Utils\FrontmatterParser;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\ZipUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\Skill\DTO\Request\GetLatestPublishedSkillVersionsRequestDTO;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;
use Qbhy\HyperfAuth\Authenticatable;
use ReflectionClass;
use ReflectionMethod;
use ReflectionProperty;
use RuntimeException;
use ZipArchive;

/** @internal */
class SkillReferencesTest extends TestCase
{
    public function testInvalidBindingsAreSkippedOnlyInNonStrictMode(): void
    {
        $service = (new ReflectionClass(SkillsMdSyncService::class))->newInstanceWithoutConstructor();
        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects(self::exactly(5))->method('warning');
        (new ReflectionProperty($service, 'logger'))->setValue($service, $logger);
        $makeVersion = static function (string $name, ?string $fileKey, string $source = 'LOCAL_UPLOAD') {
            $version = new SkillVersionEntity();
            $version->setPackageName($name);
            $version->setFileKey($fileKey);
            $version->setSourceType($source);
            return $version;
        };
        $versions = [
            'no-package' => $makeVersion('valid', null),
            'valid' => $makeVersion('valid', 'package.zip'),
            'conflict' => $makeVersion('valid', 'other.zip'),
            'invalid-name' => $makeVersion('../unsafe', 'package.zip'),
            'system' => $makeVersion('builtin', null, 'SYSTEM'),
        ];
        $codes = array_merge(['missing'], array_keys($versions));
        $method = new ReflectionMethod($service, 'buildBoundSkillEntries');
        $result = $method->invoke($service, $codes, $versions, 'SMA-example', false);
        self::assertSame([['name' => 'valid', 'code' => 'conflict', 'description' => '']], $result['market_skills']);
        self::assertSame(['builtin'], $result['system_skills']);
        foreach (['missing', 'no-package', 'invalid-name'] as $badCode) {
            try {
                $method->invoke($service, ['valid', $badCode], $versions, 'SMA-example', true);
                self::fail('Strict publication accepted invalid binding: ' . $badCode);
            } catch (RuntimeException) {
                // Each invalid binding must still stop publication.
            }
        }

        self::assertSame(
            ['market_skills' => [['name' => 'valid', 'code' => 'conflict', 'description' => '']], 'system_skills' => []],
            $method->invoke($service, ['valid', 'conflict'], $versions, 'SMA-example', true)
        );
    }

    public function testLaterSkillWithDuplicatePackageNameOverridesEarlierSkillAcrossSources(): void
    {
        $service = (new ReflectionClass(SkillsMdSyncService::class))->newInstanceWithoutConstructor();
        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects(self::exactly(2))->method('warning');
        (new ReflectionProperty($service, 'logger'))->setValue($service, $logger);
        $makeVersion = static function (string $name, ?string $fileKey, string $source = 'LOCAL_UPLOAD') {
            $version = new SkillVersionEntity();
            $version->setPackageName($name);
            $version->setFileKey($fileKey);
            $version->setSourceType($source);
            return $version;
        };
        $versions = [
            'market-first' => $makeVersion('shared', 'first.zip'),
            'system-last' => $makeVersion('shared', null, 'SYSTEM'),
            'system-first' => $makeVersion('other-shared', null, 'SYSTEM'),
            'market-last' => $makeVersion('other-shared', 'last.zip'),
        ];

        $method = new ReflectionMethod($service, 'buildBoundSkillEntries');
        self::assertSame(
            ['market_skills' => [['name' => 'other-shared', 'code' => 'market-last', 'description' => '']], 'system_skills' => ['shared']],
            $method->invoke($service, array_keys($versions), $versions, 'SMA-example', true)
        );
    }

    public function testReferenceMergeRemovalPreservesManualSkillsAndOtherMetadata(): void
    {
        $service = (new ReflectionClass(SkillsMdSyncService::class))->newInstanceWithoutConstructor();
        $content = "---\ninherit_defaults: false\nskills: [manual, old]\nsystem_skills: [builtin]\npreload: [manual]\n---\nBody\n";
        $content = $service->addSkills($content, [], [], [['name' => 'old', 'code' => 'skill-a', 'description' => 'old description']]);
        $content = $service->addSkills($content, [], [], [['name' => 'old', 'code' => 'skill-a', 'description' => 'fresh']]);
        self::assertSame([['name' => 'old', 'code' => 'skill-a', 'description' => 'fresh']], $service->getMarketSkillEntries($content));
        $parsed = FrontmatterParser::parse($service->removeSkills($content, ['old', 'skill-a']));
        self::assertSame(['manual'], $parsed['data']['skills']);
        self::assertSame([], $parsed['data']['market_skills']);
        self::assertSame(['builtin'], $parsed['data']['system_skills']);
        self::assertSame(['manual'], $parsed['data']['preload']);
        self::assertFalse($parsed['data']['inherit_defaults']);
        self::assertSame("Body\n", $parsed['body']);
    }

    public function testInvalidReferencesAreIgnoredAndCodesCanBeRemovedWithoutSkillRecord(): void
    {
        $service = (new ReflectionClass(SkillsMdSyncService::class))->newInstanceWithoutConstructor();
        $content = "---\nmarket_skills:\n  - bad\n  - {name: valid, code: skill-a}\n  - {name: 42, code: broken}\n---\n";
        self::assertCount(1, $service->getMarketSkillEntries($content));
        self::assertSame([], $service->getMarketSkillEntries($service->removeSkills($content, ['skill-a'])));
    }

    public function testStrictPublishSynchronizationDoesNotSwallowFailure(): void
    {
        $files = $this->createMock(TaskFileDomainService::class);
        $files->method('findDirectoryByPath')->willReturn(null);
        $factory = $this->createMock(LoggerFactory::class);
        $factory->method('get')->willReturn(new NullLogger());
        $service = new SkillsMdSyncService(
            $files,
            (new ReflectionClass(FileDomainService::class))->newInstanceWithoutConstructor(),
            $factory,
            $this->createMock(SuperMagicAgentSkillDomainService::class),
            $this->createMock(SkillVersionDomainService::class)
        );
        $this->expectException(RuntimeException::class);
        $service->syncSkillsMd(1, new ProjectEntity(), 'org', 'org', strict: true);
    }

    public function testPublishedDownloadUsesPublishedBindingsNotDraft(): void
    {
        $service = $this->getMockBuilder(SuperMagicAgentAppService::class)->disableOriginalConstructor()
            ->onlyMethods(['createSuperMagicDataIsolation', 'assertAgentUsable', 'assertAgentEditable'])->getMock();
        $service->method('createSuperMagicDataIsolation')->willReturn($this->getMockBuilder(SuperMagicAgentDataIsolation::class)->disableOriginalConstructor()->getMock());
        $service->expects(self::once())->method('assertAgentUsable')->with(self::anything(), 'SMA-owner');
        $service->expects(self::never())->method('assertAgentEditable');
        $version = new AgentVersionEntity();
        $version->setId(7);
        $versions = $this->createMock(SuperMagicAgentVersionDomainService::class);
        $versions->method('getLatestPublishedByCodes')->willReturn(['SMA-owner' => $version]);
        $bindings = $this->createMock(SuperMagicAgentSkillDomainService::class);
        $binding = new AgentSkillEntity();
        $binding->setSkillCode('private-skill');
        $bindings->expects(self::once())->method('getByAgentVersionId')->with(self::anything(), 7)->willReturn([$binding]);
        $bindings->expects(self::never())->method('getByAgentCodeForCurrentVersion');
        (new ReflectionProperty($service, 'superMagicAgentVersionDomainService'))->setValue($service, $versions);
        (new ReflectionProperty($service, 'superMagicAgentSkillDomainService'))->setValue($service, $bindings);
        self::assertSame(['private-skill'], $service->getDownloadableBoundSkillCodes($this->createMock(Authenticatable::class), 'SMA-owner'));
    }

    public function testUnauthorizedEmployeeCannotReadBindings(): void
    {
        $service = $this->getMockBuilder(SuperMagicAgentAppService::class)->disableOriginalConstructor()
            ->onlyMethods(['createSuperMagicDataIsolation', 'assertAgentUsable'])->getMock();
        $service->method('createSuperMagicDataIsolation')->willReturn($this->getMockBuilder(SuperMagicAgentDataIsolation::class)->disableOriginalConstructor()->getMock());
        $service->method('assertAgentUsable')->willThrowException(new RuntimeException('denied'));
        $bindings = $this->createMock(SuperMagicAgentSkillDomainService::class);
        $bindings->expects(self::never())->method('getByAgentVersionId');
        (new ReflectionProperty($service, 'superMagicAgentSkillDomainService'))->setValue($service, $bindings);
        $this->expectException(RuntimeException::class);
        $service->getDownloadableBoundSkillCodes($this->createMock(Authenticatable::class), 'SMA-other');
    }

    public function testDraftDownloadRequiresEditPermission(): void
    {
        $service = $this->getMockBuilder(SuperMagicAgentAppService::class)->disableOriginalConstructor()
            ->onlyMethods(['createSuperMagicDataIsolation', 'assertAgentEditable'])->getMock();
        $service->method('createSuperMagicDataIsolation')->willReturn($this->getMockBuilder(SuperMagicAgentDataIsolation::class)->disableOriginalConstructor()->getMock());
        $service->expects(self::once())->method('assertAgentEditable')->willThrowException(new RuntimeException('editor required'));
        $this->expectException(RuntimeException::class);
        $service->getDownloadableBoundSkillCodes($this->createMock(Authenticatable::class), 'SMA-other', true);
    }

    public function testRebuildPreservesManualDirectoriesAndOtherFrontmatter(): void
    {
        $service = (new ReflectionClass(SkillsMdSyncService::class))->newInstanceWithoutConstructor();
        $files = $this->createMock(TaskFileDomainService::class);
        $directory = $this->createMock(TaskFileEntity::class);
        $directory->method('getFileId')->willReturn(10);
        $files->method('findDirectoryByPath')->willReturn($directory);
        $child = $this->createMock(TaskFileEntity::class);
        $child->method('getIsDirectory')->willReturn(true);
        $child->method('getFileName')->willReturn('manual');
        $files->method('getChildrenByParentAndProject')->willReturn([$child]);
        (new ReflectionProperty($service, 'taskFileDomainService'))->setValue($service, $files);
        $method = new ReflectionMethod($service, 'rebuildFromInstalledSkills');
        $content = $method->invoke(
            $service,
            "---\nskills: [stale]\nsystem_skills: [manual-builtin]\npreload: [manual]\nmarket_skills: [{name: old, code: old}]\n---\nBody",
            1,
            [['name' => 'new', 'code' => 'new-code', 'description' => 'new description']],
            ['bound-builtin']
        );
        $data = FrontmatterParser::parse($content)['data'];
        self::assertSame(['manual'], $data['skills']);
        self::assertSame(['manual-builtin', 'bound-builtin'], $data['system_skills']);
        self::assertSame(['manual'], $data['preload']);
        self::assertSame('new-code', $data['market_skills'][0]['code']);
    }

    public function testDownloadEndpointIntersectsRequestedCodesWithAuthorizedEmployeeBindings(): void
    {
        $service = $this->getMockBuilder(SkillAppService::class)->disableOriginalConstructor()
            ->onlyMethods(['createSkillDataIsolation', 'getAccessibleSkillCodes'])->getMock();
        $service->method('createSkillDataIsolation')->willReturn($this->createMock(SkillDataIsolation::class));
        $service->method('getAccessibleSkillCodes')->willReturn(['personal-skill']);
        $agentService = $this->getMockBuilder(SuperMagicAgentAppService::class)->disableOriginalConstructor()
            ->onlyMethods(['getDownloadableBoundSkillCodes'])->getMock();
        $agentService->expects(self::once())->method('getDownloadableBoundSkillCodes')->with(self::anything(), 'SMA-authorized', false)->willReturn(['bound-skill']);
        (new ReflectionProperty(SkillAppService::class, 'agentAppService'))->setValue($service, $agentService);
        $context = $this->createMock(RequestContext::class);
        $context->method('getUserAuthorization')->willReturn($this->createMock(MagicUserAuthorization::class));
        $request = new GetLatestPublishedSkillVersionsRequestDTO();
        $request->agentCode = 'SMA-authorized';
        $request->codes = ['unbound-private-skill'];
        $result = $service->getLatestPublishedSkillVersions($context, $request);
        self::assertSame([], $result['list']);
        self::assertSame(0, $result['total']);
    }

    public function testImportParsesReferenceAndLegacyNamesSeparately(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'skill_reference_import_');
        $zip = new ZipArchive();
        $zip->open($path, ZipArchive::OVERWRITE);
        $zip->addFromString('employee/IDENTITY.md', "---\nname: Example\n---\n");
        $zip->addFromString('employee/SKILLS.md', "---\nskills: [manual]\nmarket_skills: [{name: referenced, code: skill-a, description: fresh}, invalid]\n---\n");
        $zip->close();
        $parsed = null;
        try {
            $parsed = (new AgentZipParser())->parse($path);
            self::assertSame(['manual'], $parsed->skills);
            self::assertSame([['name' => 'referenced', 'code' => 'skill-a', 'description' => 'fresh']], $parsed->marketSkills);
        } finally {
            unlink($path);
            if ($parsed !== null) {
                ZipUtil::removeDirectory($parsed->extractDir);
            }
        }
    }
}

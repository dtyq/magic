<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperMagic\Agent;

use App\Domain\SuperMagic\Agent\Entity\AgentMarketEntity;
use App\Domain\SuperMagic\Agent\Entity\AgentVersionEntity;
use App\Domain\SuperMagic\Agent\Entity\SuperMagicAgentEntity;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\AgentMarketType;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use App\Domain\SuperMagic\Agent\Service\SuperMagicAgentVersionDomainService;
use App\ErrorCode\SuperMagicErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use Hyperf\Config\Config;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionClass;
use RuntimeException;

/** @internal No database or application bootstrap is used. */
final class OrganizationMarketTransferOwnerTest extends TestCase
{
    private ?ContainerInterface $previousContainer;

    private array $dependencies;

    protected function setUp(): void
    {
        $this->previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        $translator = $this->createMock(TranslatorInterface::class);
        $translator->method('trans')->willReturnCallback(static fn ($key) => $key);
        $config = new Config(['error_message' => require BASE_PATH . '/config/autoload/error_message.php']);
        $container = $this->createMock(ContainerInterface::class);
        $container->method('get')->willReturnCallback(static fn ($id) => match ($id) {
            ConfigInterface::class => $config,
            TranslatorInterface::class => $translator,
            default => throw new RuntimeException('Unexpected dependency: ' . $id),
        });
        ApplicationContext::setContainer($container);
        $this->dependencies = [];
        foreach ((new ReflectionClass(SuperMagicAgentVersionDomainService::class))->getConstructor()->getParameters() as $parameter) {
            $this->dependencies[$parameter->getName()] = $this->createMock($parameter->getType()->getName());
        }
    }

    protected function tearDown(): void
    {
        if ($this->previousContainer !== null) {
            ApplicationContext::setContainer($this->previousContainer);
        }
    }

    public function testOldVersionPublishedAfterTransferKeepsSnapshotAndNewMarketOwner(): void
    {
        $version = new AgentVersionEntity([
            'id' => 42, 'code' => 'crew', 'organization_code' => 'org',
            'creator' => 'old-owner', 'name' => 'Snapshot name', 'version' => '1.0.0',
        ]);
        $agent = new SuperMagicAgentEntity(['code' => 'crew', 'creator' => 'new-owner']);
        $this->dependencies['superMagicAgentRepository']->expects(self::once())->method('getByCode')
            ->with(self::anything(), 'crew', true)->willReturn($agent);
        $market = $this->dependencies['storeAgentRepository'];
        $market->method('findByAgentCodeWithoutStatus')->willReturn(new AgentMarketEntity([
            'id' => 7, 'is_hidden' => true, 'install_count' => 12,
        ]));
        $this->dependencies['categoryRelationDomainService']->method('getVersionCategoryIds')->willReturn([3]);
        $market->expects(self::once())->method('saveOrUpdate')->willReturnCallback(static function ($isolation, AgentMarketEntity $entity) {
            self::assertSame('new-owner', $entity->getPublisherId());
            self::assertSame(42, $entity->getAgentVersionId());
            self::assertSame(7, $entity->getId());
            self::assertTrue($entity->isHidden());
            self::assertSame(12, $entity->getInstallCount());
            self::assertSame(AgentMarketType::ORGANIZATION, $entity->getMarketType());
            return $entity;
        });
        $this->service()->publishOrganizationSharedMarket($this->isolation(), $version);
        self::assertSame('old-owner', $version->getCreator());
        self::assertSame('Snapshot name', $version->getName());
    }

    public function testMissingCurrentAgentCannotRestoreHistoricalPublisher(): void
    {
        $this->dependencies['superMagicAgentRepository']->method('getByCode')->willReturn(null);
        $this->dependencies['storeAgentRepository']->expects(self::never())->method('saveOrUpdate');
        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(SuperMagicErrorCode::NotFound->value);
        $this->service()->publishOrganizationSharedMarket($this->isolation(), new AgentVersionEntity([
            'id' => 42, 'code' => 'crew', 'creator' => 'old-owner',
        ]));
    }

    private function service(): SuperMagicAgentVersionDomainService
    {
        return new SuperMagicAgentVersionDomainService(...array_values($this->dependencies));
    }

    private function isolation(): SuperMagicAgentDataIsolation
    {
        // Repositories are mocked; only the identity of this value object is needed here.
        return (new ReflectionClass(SuperMagicAgentDataIsolation::class))->newInstanceWithoutConstructor();
    }
}

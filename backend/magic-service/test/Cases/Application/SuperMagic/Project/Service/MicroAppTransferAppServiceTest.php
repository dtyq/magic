<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Project\Service;

use App\Application\SuperMagic\Project\Service\MicroAppTransferAppService;
use App\Application\SuperMagic\Project\Service\TransferAppService;
use App\Domain\SuperMagic\Project\Entity\MicroAppEntity;
use App\Domain\SuperMagic\Project\Repository\Facade\MicroAppRepositoryInterface;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\Common\DTO\Request\TransferResourceRequestDTO;
use Hyperf\Config\Config;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionProperty;
use RuntimeException;

/** @internal No real database or application bootstrap. */
final class MicroAppTransferAppServiceTest extends TestCase
{
    private ?ContainerInterface $previousContainer;

    protected function setUp(): void
    {
        $this->previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        $translator = $this->createMock(TranslatorInterface::class);
        $translator->method('trans')->willReturnCallback(static fn ($key) => $key);
        $config = new Config(['error_message' => require BASE_PATH . '/config/autoload/error_message.php']);
        $container = $this->createMock(ContainerInterface::class);
        $container->method('get')->willReturnCallback(static fn ($id) => match ($id) {
            ConfigInterface::class => $config, TranslatorInterface::class => $translator,
            default => throw new RuntimeException($id),
        });
        ApplicationContext::setContainer($container);
    }

    protected function tearDown(): void
    {
        if ($this->previousContainer !== null) {
            ApplicationContext::setContainer($this->previousContainer);
        } else {
            (new ReflectionProperty(ApplicationContext::class, 'container'))->setValue(null, null);
        }
    }

    /** @dataProvider sharingChoices */
    public function testAppIdUsesCommonProjectTransferAndPreservesItsResponse(bool $share, ?string $role, string $expectedRole): void
    {
        $apps = $this->createMock(MicroAppRepositoryInterface::class);
        $apps->method('findById')->with(30)->willReturn(new MicroAppEntity([
            'id' => 30, 'project_id' => 10, 'organization_code' => 'org',
        ]));
        $transfers = $this->createMock(TransferAppService::class);
        $response = ['batch_id' => 'batch', 'success_count' => 1, 'results' => [['resource_id' => '10', 'status' => 'success']]];
        $transfers->expects(self::once())->method('transferProjects')->with(self::anything(), self::callback(
            static fn ($dto) => $dto->getProjectIds() === ['10'] && $dto->getReceiverId() === 'receiver'
                && $dto->isShareToMe() === $share && $dto->getShareRole() === $expectedRole && ! $dto->getRetainOriginalLocation()
        ))->willReturn($response);
        $input = ['receiver_id' => 'receiver', 'share_to_me' => $share];
        if ($role !== null) {
            $input['share_role'] = $role;
        }
        self::assertSame($response, (new MicroAppTransferAppService($apps, $transfers))
            ->transfer($this->context(), 30, new TransferResourceRequestDTO($input)));
    }

    public static function sharingChoices(): array
    {
        return [[false, 'viewer', ''], [true, null, 'manage'], [true, 'editor', 'editor'], [true, 'viewer', 'viewer']];
    }

    /** @dataProvider inaccessibleApps */
    public function testUnknownAndCrossOrganizationAppIdsHaveSameNotFoundResult(?string $org): void
    {
        $apps = $this->createMock(MicroAppRepositoryInterface::class);
        $apps->method('findById')->willReturn($org === null ? null : new MicroAppEntity(['organization_code' => $org]));
        $transfers = $this->createMock(TransferAppService::class);
        $transfers->expects(self::never())->method('transferProjects');
        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(SuperAgentErrorCode::PROJECT_NOT_FOUND->value);
        (new MicroAppTransferAppService($apps, $transfers))->transfer($this->context(), 30, new TransferResourceRequestDTO());
    }

    public static function inaccessibleApps(): array
    {
        return [[null], ['other-org']];
    }

    private function context(): RequestContext
    {
        $context = $this->createMock(RequestContext::class);
        $context->method('getUserAuthorization')->willReturn((new MagicUserAuthorization())->setId('sender')->setOrganizationCode('org'));
        return $context;
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\Service;

use App\Application\ModelGateway\Service\ModelGatewayModelAccessService;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\Permission\Entity\ValueObject\ModelAccessContext;
use App\Domain\Permission\Entity\ValueObject\PermissionControlStatus;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Service\ModelAccessRoleDomainService;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\DataIsolation\BaseSubscriptionManager;
use App\Infrastructure\Core\Exception\BusinessException;
use Closure;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class ModelGatewayModelAccessServiceTest extends TestCase
{
    public function testResolveAccessContextBackfillsMagicIdWithoutMutatingSourceIsolation(): void
    {
        $expectedContext = new ModelAccessContext(PermissionControlStatus::ENABLED, [], ['model-a']);
        $subscriptionManager = new BaseSubscriptionManager();
        $subscriptionManager->setEnabled(false);
        $permissionDataIsolation = new class($subscriptionManager) extends PermissionDataIsolation {
            private string $magicId = '';

            public function __construct(private BaseSubscriptionManager $subscriptionManager)
            {
            }

            public function getCurrentUserId(): string
            {
                return 'user-1';
            }

            public function getSubscriptionManager(): BaseSubscriptionManager
            {
                return $this->subscriptionManager;
            }

            public function getMagicId(): string
            {
                return $this->magicId;
            }

            public function setMagicId(string $magicId): static
            {
                $this->magicId = $magicId;
                return $this;
            }
        };

        $domainService = new readonly class($expectedContext, function (PermissionDataIsolation $dataIsolation, string $userId): void {
            $this->assertSame('magic-1', $dataIsolation->getMagicId());
            $this->assertFalse($dataIsolation->getSubscriptionManager()->isEnabled());
            $this->assertSame('user-1', $userId);
        }) extends ModelAccessRoleDomainService {
            public function __construct(
                private ModelAccessContext $context,
                private Closure $assertion
            ) {
            }

            public function resolveAccessContext(PermissionDataIsolation $dataIsolation, string $userId): ModelAccessContext
            {
                ($this->assertion)($dataIsolation, $userId);
                return $this->context;
            }
        };

        $userEntity = new MagicUserEntity();
        $userEntity->setUserId('user-1');
        $userEntity->setMagicId('magic-1');

        $magicUserDomainService = $this->createMock(MagicUserDomainService::class);
        $magicUserDomainService->expects($this->once())
            ->method('getByUserId')
            ->with('user-1')
            ->willReturn($userEntity);

        $service = new readonly class($domainService, $magicUserDomainService, $permissionDataIsolation) extends ModelGatewayModelAccessService {
            public function __construct(
                ModelAccessRoleDomainService $modelAccessRoleDomainService,
                MagicUserDomainService $magicUserDomainService,
                private PermissionDataIsolation $permissionDataIsolation
            ) {
                parent::__construct($modelAccessRoleDomainService, $magicUserDomainService);
            }

            protected function createPermissionDataIsolation(ModelGatewayDataIsolation $dataIsolation): PermissionDataIsolation
            {
                return $this->permissionDataIsolation;
            }
        };
        $dataIsolation = new class($subscriptionManager) extends ModelGatewayDataIsolation {
            private string $magicId = '';

            public function __construct(private BaseSubscriptionManager $subscriptionManager)
            {
            }

            public function getCurrentUserId(): string
            {
                return 'user-1';
            }

            public function getSubscriptionManager(): BaseSubscriptionManager
            {
                return $this->subscriptionManager;
            }

            public function getMagicId(): string
            {
                return $this->magicId;
            }

            public function setMagicId(string $magicId): static
            {
                $this->magicId = $magicId;
                return $this;
            }
        };

        $context = $service->resolveAccessContext($dataIsolation);

        $this->assertSame($expectedContext, $context);
        $this->assertSame('', $dataIsolation->getMagicId());
    }

    public function testAssertCanAccessThrowsUnifiedPermissionError(): void
    {
        $service = new readonly class(
            new readonly class(new ModelAccessContext(PermissionControlStatus::DISABLED, [], [])) extends ModelAccessRoleDomainService {
                public function __construct(private ModelAccessContext $context)
                {
                }

                public function resolveAccessContext(PermissionDataIsolation $dataIsolation, string $userId): ModelAccessContext
                {
                    return $this->context;
                }
            },
            $this->createMock(MagicUserDomainService::class)
        ) extends ModelGatewayModelAccessService {
            protected function getInsufficientPermissionMessage(): string
            {
                return 'insufficient_permission_for_model';
            }

            protected function throwInsufficientPermissionException(): never
            {
                throw new BusinessException('insufficient_permission_for_model', ServiceProviderErrorCode::InvalidParameter->value);
            }
        };

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(ServiceProviderErrorCode::InvalidParameter->value);

        $service->assertCanAccess(
            new ModelAccessContext(PermissionControlStatus::ENABLED, ['model-b'], ['model-a']),
            'model-b'
        );
    }

    public function testAssertCanAccessSkipsCheckWhenPermissionControlDisabled(): void
    {
        $service = new readonly class(
            new readonly class(new ModelAccessContext(PermissionControlStatus::DISABLED, [], [])) extends ModelAccessRoleDomainService {
                public function __construct(private ModelAccessContext $context)
                {
                }

                public function resolveAccessContext(PermissionDataIsolation $dataIsolation, string $userId): ModelAccessContext
                {
                    return $this->context;
                }
            },
            $this->createMock(MagicUserDomainService::class)
        ) extends ModelGatewayModelAccessService {
        };

        $service->assertCanAccess(
            new ModelAccessContext(PermissionControlStatus::DISABLED, [], []),
            'model-b'
        );

        $this->assertTrue(true);
    }
}

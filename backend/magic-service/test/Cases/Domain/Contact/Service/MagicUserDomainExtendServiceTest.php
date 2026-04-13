<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Contact\Service;

use App\Domain\Contact\DTO\UserUpdateDTO;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Repository\Facade\MagicUserRepositoryInterface;
use App\Domain\Contact\Service\MagicUserDomainExtendService;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class MagicUserDomainExtendServiceTest extends TestCase
{
    public function testUpdateUserInfoPersistsTimezoneWhenProvided(): void
    {
        $repository = $this->createMock(MagicUserRepositoryInterface::class);
        $repository->expects($this->once())
            ->method('updateDataById')
            ->with('user-1', ['timezone' => 'Asia/Shanghai'])
            ->willReturn(1);

        $service = new MagicUserDomainExtendService($repository);
        $dataIsolation = $this->createDataIsolation('user-1');

        $userUpdateDTO = new UserUpdateDTO();
        $userUpdateDTO->setTimezone('Asia/Shanghai');

        $result = $service->updateUserInfo($dataIsolation, $userUpdateDTO);

        $this->assertSame(1, $result);
    }

    public function testUpdateUserInfoPersistsNullTimezoneWhenExplicitlyProvided(): void
    {
        $repository = $this->createMock(MagicUserRepositoryInterface::class);
        $repository->expects($this->once())
            ->method('updateDataById')
            ->with('user-1', ['timezone' => null])
            ->willReturn(1);

        $service = new MagicUserDomainExtendService($repository);
        $dataIsolation = $this->createDataIsolation('user-1');

        $userUpdateDTO = new UserUpdateDTO();
        $userUpdateDTO->setTimezone(null);

        $result = $service->updateUserInfo($dataIsolation, $userUpdateDTO);

        $this->assertSame(1, $result);
    }

    public function testUpdateUserInfoDoesNotPersistTimezoneWhenFieldMissing(): void
    {
        $repository = $this->createMock(MagicUserRepositoryInterface::class);
        $repository->expects($this->once())
            ->method('updateDataById')
            ->with('user-1', [])
            ->willReturn(1);

        $service = new MagicUserDomainExtendService($repository);
        $dataIsolation = $this->createDataIsolation('user-1');

        $userUpdateDTO = new UserUpdateDTO();

        $result = $service->updateUserInfo($dataIsolation, $userUpdateDTO);

        $this->assertSame(1, $result);
    }

    private function createDataIsolation(string $userId): DataIsolation
    {
        $dataIsolation = $this->createMock(DataIsolation::class);
        $dataIsolation->method('getCurrentUserId')->willReturn($userId);
        return $dataIsolation;
    }
}

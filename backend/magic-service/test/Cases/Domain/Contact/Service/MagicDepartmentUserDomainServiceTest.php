<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Contact\Service;

use App\Domain\Contact\Entity\MagicDepartmentUserEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Repository\Facade\MagicDepartmentUserRepositoryInterface;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class MagicDepartmentUserDomainServiceTest extends TestCase
{
    public function testSearchDepartmentUsersByEmployeeNoUsesCurrentOrganization(): void
    {
        $repository = $this->createMock(MagicDepartmentUserRepositoryInterface::class);
        $repository->expects($this->once())
            ->method('searchDepartmentUsersByEmployeeNo')
            ->with('EMP001', 'org-1')
            ->willReturn([new MagicDepartmentUserEntity(['user_id' => 'user-1', 'employee_no' => 'EMP001'])]);

        $dataIsolation = DataIsolation::create('org-1', 'user-1');
        $result = (new MagicDepartmentUserDomainService($repository))
            ->searchDepartmentUsersByEmployeeNo('EMP001', $dataIsolation);

        $this->assertSame('EMP001', $result[0]->getEmployeeNo());
    }
}

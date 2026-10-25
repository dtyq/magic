<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\Contact\Assembler;

use App\Interfaces\Contact\Assembler\OpenUserSearchAssembler;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class OpenUserSearchAssemblerTest extends TestCase
{
    public function testCreatePageResponseIncludesEmployeeNo(): void
    {
        $result = OpenUserSearchAssembler::createPageResponse([
            'items' => [[
                'user_id' => 'user-1',
                'nickname' => 'Nick',
                'real_name' => 'Real',
                'phone' => '13212345678',
                'employee_no' => 'EMP001',
            ]],
        ]);

        $this->assertSame('EMP001', $result['items'][0]['employee_no']);
        $this->assertSame('132****678', $result['items'][0]['phone']);
    }

    public function testCreatePageResponseUsesEmptyEmployeeNoWhenMissing(): void
    {
        $result = OpenUserSearchAssembler::createPageResponse(['items' => [[]]]);

        $this->assertSame('', $result['items'][0]['employee_no']);
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\SuperMagic\Project\DTO\Request;

use App\Interfaces\SuperMagic\Project\DTO\Request\CreateSpecialProjectRequestDTO;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class CreateSpecialProjectRequestDTOTest extends TestCase
{
    public function testConstructorMapsInternalProjectDefaults(): void
    {
        $dto = new CreateSpecialProjectRequestDTO([
            'key' => 'micro-app-runtime-1001',
            'project_name' => 'micro-app-runtime-1001',
            'dynamic_params' => [
                'agent_mode' => 'micro-app',
                'message_version' => 'v2',
            ],
        ]);

        self::assertSame('micro-app-runtime-1001', $dto->getKey());
        self::assertSame('micro-app-runtime-1001', $dto->getProjectName());
        self::assertSame([
            'agent_mode' => 'micro-app',
            'message_version' => 'v2',
        ], $dto->getDynamicParams());
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperMagic\Project\Repository\Persistence;

use App\Domain\SuperMagic\Project\Repository\Persistence\MicroAppTransferRepository;
use PHPUnit\Framework\TestCase;

/** @internal */
final class MicroAppTransferRepositoryHydrationTest extends TestCase
{
    public function testNullableProjectColumnsFallBackToEntityDefaults(): void
    {
        $project = MicroAppTransferRepository::hydrateProject([
            'id' => 7, 'user_id' => 'u', 'project_name' => 'n', 'project_description' => null, 'default_join_permission' => null,
        ]);

        self::assertSame(7, $project->getId());
        self::assertSame('', $project->getProjectDescription());
    }
}

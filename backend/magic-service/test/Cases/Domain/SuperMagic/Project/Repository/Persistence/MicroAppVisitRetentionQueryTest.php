<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperMagic\Project\Repository\Persistence;

use App\Domain\SuperMagic\Project\Repository\Persistence\MicroAppVisitRepository;
use Hyperf\Database\ConnectionInterface;
use Hyperf\Database\Query\Builder;
use Hyperf\Database\Query\Grammars\MySqlGrammar;
use Hyperf\Database\Query\Processors\Processor;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
final class MicroAppVisitRetentionQueryTest extends TestCase
{
    public function testRetentionQueryUsesLimitInsteadOfBareOffset(): void
    {
        $connection = $this->createMock(ConnectionInterface::class);
        $query = (new Builder($connection, new MySqlGrammar(), new Processor()))
            ->from('magic_super_agent_micro_app_visits')
            ->where('user_id', 'user-1')
            ->where('organization_code', 'org-1');

        $sql = (new TestableMicroAppVisitRepository())->exposeOverflowVisitWindow($query)->toSql();

        self::assertStringContainsString('offset 20', $sql);
        self::assertStringContainsString('limit 1000', $sql);
    }
}

final class TestableMicroAppVisitRepository extends MicroAppVisitRepository
{
    public function exposeOverflowVisitWindow(object $query): object
    {
        return $this->applyOverflowVisitWindow($query);
    }
}

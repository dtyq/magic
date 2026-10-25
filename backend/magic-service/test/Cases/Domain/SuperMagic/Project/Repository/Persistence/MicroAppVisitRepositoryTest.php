<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperMagic\Project\Repository\Persistence;

use App\Domain\SuperMagic\Project\Repository\Persistence\MicroAppVisitRepository;
use App\Domain\SuperMagic\Project\Repository\Persistence\Model\MicroAppVisitModel;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Carbon\Carbon;
use Hyperf\Database\Schema\Schema;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
final class MicroAppVisitRepositoryTest extends TestCase
{
    private string $userId = '';

    private string $organizationCode = 'DT_VISIT_TEST';

    protected function setUp(): void
    {
        parent::setUp();

        if (! Schema::hasTable('magic_super_agent_micro_app_visits')) {
            self::markTestSkipped('micro app visit table is not migrated');
        }

        $this->userId = 'visit_repo_' . str_replace('.', '', uniqid('', true));
    }

    protected function tearDown(): void
    {
        if ($this->userId !== '' && Schema::hasTable('magic_super_agent_micro_app_visits')) {
            MicroAppVisitModel::query()->where('user_id', $this->userId)->delete();
        }

        parent::tearDown();
    }

    public function testRecordVisitSucceedsWhenVisitCountIsBelowRetentionLimit(): void
    {
        $repository = new MicroAppVisitRepository();

        $repository->recordVisit(IdGenerator::getSnowId(), $this->userId, $this->organizationCode);

        self::assertSame(1, $this->visitCount());
    }

    public function testRecordVisitDropsOldestVisitsBeyondRetentionLimit(): void
    {
        $keptAppId = IdGenerator::getSnowId();
        $droppedAppId = IdGenerator::getSnowId();
        $now = Carbon::now()->subMinutes(5);
        $this->insertVisit($droppedAppId, $now->copy()->subMinutes(20));
        for ($index = 0; $index < 19; ++$index) {
            $this->insertVisit(IdGenerator::getSnowId(), $now->copy()->subMinutes(19 - $index));
        }

        (new MicroAppVisitRepository())->recordVisit($keptAppId, $this->userId, $this->organizationCode);

        $appIds = MicroAppVisitModel::query()
            ->where('user_id', $this->userId)
            ->where('organization_code', $this->organizationCode)
            ->pluck('micro_app_id')
            ->map(static fn (mixed $id): int => (int) $id)
            ->all();

        self::assertCount(20, $appIds);
        self::assertContains($keptAppId, $appIds);
        self::assertNotContains($droppedAppId, $appIds);
    }

    private function visitCount(): int
    {
        return MicroAppVisitModel::query()
            ->where('user_id', $this->userId)
            ->where('organization_code', $this->organizationCode)
            ->count();
    }

    private function insertVisit(int $microAppId, Carbon $visitedAt): void
    {
        MicroAppVisitModel::query()->insert([
            'id' => IdGenerator::getSnowId(),
            'micro_app_id' => $microAppId,
            'user_id' => $this->userId,
            'organization_code' => $this->organizationCode,
            'last_visited_at' => $visitedAt->toDateTimeString(),
            'created_at' => $visitedAt->toDateTimeString(),
            'updated_at' => $visitedAt->toDateTimeString(),
        ]);
    }
}

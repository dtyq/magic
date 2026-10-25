<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\SuperMagic\Agent;

use App\Domain\SuperMagic\Agent\Entity\SuperMagicAgentEntity;
use App\Interfaces\SuperMagic\Agent\Assembler\SuperMagicAgentAssembler;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** @internal Tests the serialized list contract consumed by the transfer menu. */
final class CreatedAgentListRoleTest extends TestCase
{
    #[DataProvider('owners')]
    public function testCreatedListSerializesTheActualOwnerRole(string $creator, string $viewer, ?string $expectedRole): void
    {
        $agent = new SuperMagicAgentEntity([
            'id' => 123,
            'code' => 'test-agent',
            'name' => 'Test agent',
            'creator' => $creator,
            'organization_code' => 'test-org',
            'source_type' => 'LOCAL_CREATE',
            'created_at' => '2026-01-01 00:00:00',
            'updated_at' => '2026-01-01 00:00:00',
        ]);
        $response = SuperMagicAgentAssembler::createMyAgentsResponseDTO(
            agents: [$agent],
            playbooksMap: [],
            storeAgentsMap: [],
            latestVersionsMap: [],
            userAgentsMap: [],
            currentUserId: $viewer,
            page: 1,
            pageSize: 20,
            total: 1,
        )->toArray();

        self::assertSame($expectedRole, $response['list'][0]['user_role']);
        self::assertSame('created', $response['list'][0]['scope']);
    }

    public static function owners(): array
    {
        return [
            'current owner' => ['sender', 'sender', 'owner'],
            'different creator' => ['another-user', 'sender', null],
            'old owner after transfer' => ['receiver', 'sender', null],
            'new owner after transfer' => ['receiver', 'receiver', 'owner'],
        ];
    }
}

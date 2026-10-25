<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\KnowledgeBase\Rpc\Service;

use App\Application\SuperMagic\Agent\Service\SuperMagicAgentAccessAppService;
use App\Interfaces\KnowledgeBase\Rpc\Service\SuperMagicAgentRpcService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use stdClass;

/** @internal */
class SuperMagicAgentRpcServiceTest extends TestCase
{
    #[DataProvider('accessibleCodesProvider')]
    public function testAccessibleCodesPreservesJsonMapAndListTypes(array $agentCodes, array $data): void
    {
        $access = $this->createMock(SuperMagicAgentAccessAppService::class);
        $access->expects($this->once())
            ->method('listAccessibleAgentCodes')
            ->with('ORG-1', 'USER-1', $agentCodes)
            ->willReturn($data);
        $service = new SuperMagicAgentRpcService($access, $this->createMock(LoggerInterface::class));

        $result = $service->listAccessibleCodes([
            'data_isolation' => ['organization_code' => 'ORG-1', 'user_id' => 'USER-1'],
            'agent_codes' => $agentCodes,
        ]);
        $decoded = json_decode(json_encode($result, JSON_THROW_ON_ERROR), false, 512, JSON_THROW_ON_ERROR);

        $this->assertSame(0, $decoded->code);
        $this->assertInstanceOf(stdClass::class, $decoded->data->agent_organizations);
        $this->assertSame($data['agent_organizations'], (array) $decoded->data->agent_organizations);
        $this->assertSame($data['accessible_codes'], $decoded->data->accessible_codes);
        $this->assertSame($data['missing_codes'], $decoded->data->missing_codes);
    }

    public static function accessibleCodesProvider(): array
    {
        return [
            'empty request' => [[], [
                'accessible_codes' => [],
                'missing_codes' => [],
                'agent_organizations' => [],
            ]],
            'no accessible agents' => [['AGENT-1'], [
                'accessible_codes' => [],
                'missing_codes' => [],
                'agent_organizations' => [],
            ]],
            'accessible and missing agents' => [['AGENT-1', 'AGENT-2'], [
                'accessible_codes' => ['AGENT-1'],
                'missing_codes' => ['AGENT-2'],
                'agent_organizations' => ['AGENT-1' => 'ORG-1'],
            ]],
        ];
    }
}

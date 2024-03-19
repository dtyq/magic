<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Agent\Official;

use App\Infrastructure\Util\OfficialOrganizationUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Application\Agent\Service\SuperMagicAgentAppService;
use Throwable;

/**
 * Official Agents Initializer.
 * Initialize official agents for new system setup.
 */
class OfficialAgentsInitializer
{
    /**
     * 创建官方员工.
     *
     * @param string $userId 用户ID
     * @param array<string> $agentCodes 要同步的员工 code，为空则同步全部
     * @return array{success: bool, message: string, success_count: int, skip_count: int, fail_count: int, results: array}
     */
    public static function init(string $userId, array $agentCodes = []): array
    {
        $officialOrganizationCode = OfficialOrganizationUtil::getOfficialOrganizationCode();
        if (empty($officialOrganizationCode)) {
            return [
                'success' => false,
                'message' => 'Official organization code not configured in service_provider.office_organization',
                'success_count' => 0,
                'skip_count' => 0,
                'fail_count' => 0,
                'results' => [],
            ];
        }

        try {
            $authorization = new MagicUserAuthorization();
            $authorization->setId($userId);
            $authorization->setOrganizationCode($officialOrganizationCode);

            $superMagicAgentAppService = di(SuperMagicAgentAppService::class);
            $result = $superMagicAgentAppService->createOfficialAgents(
                $authorization,
                $officialOrganizationCode,
                $userId,
                $agentCodes === [] ? null : $agentCodes
            );

            return [
                'success' => true,
                'message' => "Created {$result['success_count']} agents, skipped {$result['skip_count']}, failed {$result['fail_count']}",
                'success_count' => $result['success_count'],
                'skip_count' => $result['skip_count'],
                'fail_count' => $result['fail_count'],
                'results' => $result['results'],
            ];
        } catch (Throwable $e) {
            return [
                'success' => false,
                'message' => 'Failed to create official agents: ' . $e->getMessage(),
                'success_count' => 0,
                'skip_count' => 0,
                'fail_count' => 0,
                'results' => [],
            ];
        }
    }
}

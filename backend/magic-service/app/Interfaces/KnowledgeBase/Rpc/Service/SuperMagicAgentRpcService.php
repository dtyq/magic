<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\Rpc\Service;

use App\Infrastructure\Rpc\Annotation\RpcMethod;
use App\Infrastructure\Rpc\Annotation\RpcService;
use App\Infrastructure\Rpc\Method\SvcMethods;
use Dtyq\SuperMagic\Application\Agent\Service\SuperMagicAgentAccessAppService;
use Psr\Log\LoggerInterface;
use Throwable;

#[RpcService(name: SvcMethods::SERVICE_KNOWLEDGE_SUPER_MAGIC_AGENT)]
readonly class SuperMagicAgentRpcService
{
    public function __construct(
        private SuperMagicAgentAccessAppService $superMagicAgentAccessAppService,
        private LoggerInterface $logger,
    ) {
    }

    #[RpcMethod(name: SvcMethods::METHOD_LIST_MANAGEABLE_CODES)]
    public function listManageableCodes(array $params): array
    {
        ['organization_code' => $organizationCode, 'user_id' => $userId, 'agent_codes' => $agentCodes] = $this->resolveAccessContext($params);

        if ($organizationCode === '' || $userId === '') {
            return $this->buildMissingIdentityResponse();
        }

        try {
            $data = $this->superMagicAgentAccessAppService->listManageableAgentCodes(
                $organizationCode,
                $userId,
                $agentCodes,
            );

            return [
                'code' => 0,
                'message' => 'success',
                'data' => $data,
            ];
        } catch (Throwable $throwable) {
            $this->logger->error('IPC SuperMagicAgent listManageableCodes failed', [
                'organization_code' => $organizationCode,
                'user_id' => $userId,
                'agent_codes' => $agentCodes,
                'error' => $throwable->getMessage(),
            ]);

            return [
                'code' => 500,
                'message' => $throwable->getMessage(),
            ];
        }
    }

    #[RpcMethod(name: SvcMethods::METHOD_LIST_ACCESSIBLE_CODES)]
    public function listAccessibleCodes(array $params): array
    {
        ['organization_code' => $organizationCode, 'user_id' => $userId, 'agent_codes' => $agentCodes] = $this->resolveAccessContext($params);

        if ($organizationCode === '' || $userId === '') {
            return $this->buildMissingIdentityResponse();
        }

        try {
            $data = $this->superMagicAgentAccessAppService->listAccessibleAgentCodes(
                $organizationCode,
                $userId,
                $agentCodes,
            );

            return [
                'code' => 0,
                'message' => 'success',
                'data' => $data,
            ];
        } catch (Throwable $throwable) {
            $this->logger->error('IPC SuperMagicAgent listAccessibleCodes failed', [
                'organization_code' => $organizationCode,
                'user_id' => $userId,
                'agent_codes' => $agentCodes,
                'error' => $throwable->getMessage(),
            ]);

            return [
                'code' => 500,
                'message' => $throwable->getMessage(),
            ];
        }
    }

    /**
     * @param array<string, mixed> $params
     * @return array{
     *     organization_code: string,
     *     user_id: string,
     *     agent_codes: array<int, string>
     * }
     */
    private function resolveAccessContext(array $params): array
    {
        $dataIsolation = (array) ($params['data_isolation'] ?? []);

        return [
            'organization_code' => trim((string) ($dataIsolation['organization_code'] ?? '')),
            'user_id' => trim((string) ($dataIsolation['user_id'] ?? '')),
            'agent_codes' => array_values(array_map(
                static fn (mixed $value): string => trim((string) $value),
                (array) ($params['agent_codes'] ?? [])
            )),
        ];
    }

    /**
     * @return array{code: 400, message: string}
     */
    private function buildMissingIdentityResponse(): array
    {
        return [
            'code' => 400,
            'message' => 'organization_code and user_id are required',
        ];
    }
}

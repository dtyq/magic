<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Workspace;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AbstractSandboxOS;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Constants\SandboxEndpoints;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Workspace\Request\ExportWorkspaceRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Workspace\Response\ExportWorkspaceResponse;
use Exception;
use Hyperf\Logger\LoggerFactory;

/**
 * Workspace exporter service implementation.
 * Routes the export request through the sandbox proxy (proxySandboxRequest),
 * following the same pattern as FileConverterService and SandboxAgentService.
 */
class WorkspaceExporterService extends AbstractSandboxOS implements WorkspaceExporterInterface
{
    public function __construct(
        LoggerFactory $loggerFactory,
        private readonly SandboxGatewayInterface $gateway,
    ) {
        parent::__construct($loggerFactory);
    }

    /**
     * Export workspace to object storage via sandbox proxy.
     */
    public function export(string $sandboxId, ExportWorkspaceRequest $request): ExportWorkspaceResponse
    {
        $sourcePath = $request->getSourcePath();
        $hasSourcePath = $sourcePath !== null && $sourcePath !== '';

        $this->logger->info('[Sandbox][Workspace] Exporting workspace', [
            'sandbox_id' => $sandboxId,
            'type' => $request->getType(),
            'code' => $request->getCode(),
            'has_source_path' => $hasSourcePath,
            'source_path' => $sourcePath,
        ]);

        try {
            $result = $this->gateway->proxySandboxRequest(
                $sandboxId,
                'POST',
                SandboxEndpoints::WORKSPACE_EXPORT,
                $request->toArray()
            );

            $response = ExportWorkspaceResponse::fromGatewayResult($result);

            if ($response->isSuccess()) {
                $this->logger->info('[Sandbox][Workspace] Workspace exported successfully', [
                    'sandbox_id' => $sandboxId,
                    'type' => $request->getType(),
                    'code' => $request->getCode(),
                    'file_key' => $response->getFileKey(),
                    'has_source_path' => $hasSourcePath,
                    'source_path' => $sourcePath,
                ]);
            } else {
                $this->logger->error('[Sandbox][Workspace] Failed to export workspace', [
                    'sandbox_id' => $sandboxId,
                    'type' => $request->getType(),
                    'code' => $request->getCode(),
                    'response_code' => $response->getCode(),
                    'response_message' => $response->getMessage(),
                    'has_source_path' => $hasSourcePath,
                    'source_path' => $sourcePath,
                ]);
            }

            return $response;
        } catch (Exception $e) {
            $this->logger->error('[Sandbox][Workspace] Unexpected error when exporting workspace', [
                'sandbox_id' => $sandboxId,
                'type' => $request->getType(),
                'code' => $request->getCode(),
                'error' => $e->getMessage(),
                'has_source_path' => $hasSourcePath,
                'source_path' => $sourcePath,
            ]);

            return ExportWorkspaceResponse::fromApiResponse([
                'code' => -1,
                'message' => 'Unexpected error: ' . $e->getMessage(),
                'data' => [],
            ]);
        }
    }
}

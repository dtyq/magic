<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\PdfConverter;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AbstractSandboxOS;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\PdfConverter\Request\PdfConverterRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\PdfConverter\Response\PdfConverterResponse;
use Exception;
use Hyperf\Logger\LoggerFactory;

class PdfConverterService extends AbstractSandboxOS implements PdfConverterInterface
{
    public function __construct(
        LoggerFactory $loggerFactory,
        private SandboxGatewayInterface $gateway
    ) {
        parent::__construct($loggerFactory);
    }

    public function convert(string $sandboxId, PdfConverterRequest $request): PdfConverterResponse
    {
        $requestData = $request->toArray();
        try {
            // 使用网关的 ensureSandboxAndProxy 方法，自动处理沙箱检查和创建
            $result = $this->gateway->ensureSandboxAndProxy(
                $sandboxId,
                'POST',
                'api/pdf/converts',
                $requestData
            );

            $response = PdfConverterResponse::fromGatewayResult($result);

            if ($response->isSuccess()) {
                $actualSandboxId = $result->getDataValue('actual_sandbox_id') ?? $sandboxId;
                $this->logger->info('[PDF Converter] Conversion successful', [
                    'original_sandbox_id' => $sandboxId,
                    'actual_sandbox_id' => $actualSandboxId,
                    'batch_id' => $response->getBatchId(),
                    'converted_files_count' => count($response->getConvertedFiles()),
                ]);
            } else {
                $this->logger->error('[PDF Converter] Conversion failed', [
                    'sandbox_id' => $sandboxId,
                    'code' => $response->getCode(),
                    'message' => $response->getMessage(),
                ]);
            }

            return $response;
        } catch (Exception $e) {
            $this->logger->error('[PDF Converter] Unexpected error during conversion', [
                'sandbox_id' => $sandboxId,
                'error' => $e->getMessage(),
            ]);

            return PdfConverterResponse::fromApiResponse([
                'code' => -1,
                'message' => 'Unexpected error: ' . $e->getMessage(),
                'data' => [],
            ]);
        }
    }
}

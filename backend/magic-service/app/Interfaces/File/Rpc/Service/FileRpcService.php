<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\File\Rpc\Service;

use App\Domain\File\Service\FileDomainService;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Rpc\Annotation\RpcMethod;
use App\Infrastructure\Rpc\Annotation\RpcService;
use App\Infrastructure\Rpc\Method\SvcMethods;
use Psr\Log\LoggerInterface;
use Throwable;

#[RpcService(name: SvcMethods::SERVICE_FILE)]
class FileRpcService
{
    public function __construct(
        private readonly FileDomainService $fileDomainService,
        private readonly LoggerInterface $logger,
    ) {
    }

    #[RpcMethod(name: SvcMethods::METHOD_GET_LINK)]
    public function getLink(array $params): array
    {
        $organizationCode = (string) ($params['organization_code'] ?? '');
        $rawFilePath = (string) ($params['file_path'] ?? '');
        $bucketType = $this->resolveBucketType($params['bucket_type'] ?? null);

        if ($organizationCode === '') {
            return [
                'code' => 400,
                'message' => 'organization_code is required',
            ];
        }

        $filePath = $this->normalizeFilePath($rawFilePath);
        if ($filePath === '') {
            return [
                'code' => 400,
                'message' => 'file_path is required',
            ];
        }

        try {
            $link = $this->fileDomainService->getLink($organizationCode, $filePath, $bucketType);
            if ($link === null) {
                return [
                    'code' => 404,
                    'message' => 'file not found',
                ];
            }

            return [
                'code' => 0,
                'message' => 'success',
                'data' => $link->toArray(),
            ];
        } catch (Throwable $exception) {
            $this->logger->error('IPC File getLink failed', [
                'organization_code' => $organizationCode,
                'file_path' => $filePath,
                'error' => $exception->getMessage(),
            ]);

            return [
                'code' => 500,
                'message' => $exception->getMessage(),
            ];
        }
    }

    #[RpcMethod(name: SvcMethods::METHOD_STAT)]
    public function stat(array $params): array
    {
        $organizationCode = (string) ($params['organization_code'] ?? '');
        $rawFilePath = (string) ($params['file_path'] ?? '');
        $bucketType = $this->resolveBucketType($params['bucket_type'] ?? null);

        if ($organizationCode === '') {
            return [
                'code' => 400,
                'message' => 'organization_code is required',
            ];
        }

        $filePath = $this->normalizeFilePath($rawFilePath);
        if ($filePath === '') {
            return [
                'code' => 400,
                'message' => 'file_path is required',
            ];
        }

        try {
            $metas = $this->fileDomainService->getMetas([$filePath], $organizationCode);
            $exists = array_key_exists($filePath, $metas);
            if (! $exists) {
                foreach ($metas as $meta) {
                    if (is_object($meta) && method_exists($meta, 'getPath') && $meta->getPath() === $filePath) {
                        $exists = true;
                        break;
                    }
                }
            }

            if (! $exists) {
                return [
                    'code' => 404,
                    'message' => 'file not found',
                ];
            }

            return [
                'code' => 0,
                'message' => 'success',
                'data' => [
                    'exists' => true,
                    'path' => $filePath,
                    'bucket_type' => $bucketType->value,
                ],
            ];
        } catch (Throwable $exception) {
            $this->logger->error('IPC File stat failed', [
                'organization_code' => $organizationCode,
                'file_path' => $filePath,
                'error' => $exception->getMessage(),
            ]);

            return [
                'code' => 500,
                'message' => $exception->getMessage(),
            ];
        }
    }

    private function normalizeFilePath(string $rawFilePath): string
    {
        $filePath = trim($rawFilePath);
        if ($filePath === '') {
            return '';
        }

        if (is_url($filePath)) {
            $parsedPath = (string) parse_url($filePath, PHP_URL_PATH);
            $filePath = $parsedPath;
        }

        return ltrim($filePath, '/');
    }

    private function resolveBucketType(mixed $value): StorageBucketType
    {
        if (! is_string($value) || trim($value) === '') {
            return StorageBucketType::Private;
        }
        return StorageBucketType::tryFrom(trim($value)) ?? StorageBucketType::Private;
    }
}

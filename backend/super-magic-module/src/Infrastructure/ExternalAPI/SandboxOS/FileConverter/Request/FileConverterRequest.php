<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\FileConverter\Request;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ConvertType;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Contract\RequestInterface;

/**
 * 文件转换请求
 */
class FileConverterRequest implements RequestInterface
{
    private array $fileKeys = [];

    private array $options = [];

    private string $outputFormat = 'zip';

    private bool $isDebug = false;

    private string $convertType;

    private string $taskKey = '';

    private string $sandboxId = '';

    private array $stsTemporaryCredential = [];

    private string $userId = '';

    private string $organizationCode = '';

    public function __construct(string $sandboxId, string $convertType, array $fileKeys, array $stsTemporaryCredential = [], array $options = [], string $taskKey = '', string $userId = '', string $organizationCode = '')
    {
        $this->sandboxId = $sandboxId;
        $this->convertType = $convertType;
        $this->fileKeys = $fileKeys;
        $this->stsTemporaryCredential = $stsTemporaryCredential;
        $this->taskKey = $taskKey;
        $this->userId = $userId;
        $this->organizationCode = $organizationCode;

        if (isset($options['is_debug'])) {
            $this->isDebug = (bool) $options['is_debug'];
            unset($options['is_debug']);
        }

        $defaultOptions = match ($convertType) {
            ConvertType::PDF->value => [
                'format' => 'A4',
                'orientation' => 'portrait',
                'wait_for_load' => 5000,
                'print_background' => true,
                'margin_top' => '1cm',
                'margin_bottom' => '1cm',
                'margin_left' => '1cm',
                'margin_right' => '1cm',
                'scale' => 0.8,
                'display_header_footer' => false,
            ],
            ConvertType::PPT->value => [
                // Add PPT default options here
            ],
            ConvertType::IMAGE->value => [
                // Add Image default options here
            ],
            default => [],
        };

        $this->options = array_merge($defaultOptions, $options);
    }

    public function getSandboxId(): string
    {
        return $this->sandboxId;
    }

    public function getConvertType(): string
    {
        return $this->convertType;
    }

    public function getFileKeys(): array
    {
        return $this->fileKeys;
    }

    public function getStsTemporaryCredential(): array
    {
        return $this->stsTemporaryCredential;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function toArray(): array
    {
        $result = [
            'file_keys' => $this->fileKeys,
            'output_format' => $this->outputFormat,
            'is_debug' => $this->isDebug,
            'convert_type' => $this->convertType,
            'task_key' => $this->taskKey,
        ];

        // 添加用户相关字段（只有当字段不为空时才包含）
        if (! empty($this->userId)) {
            $result['user_id'] = $this->userId;
        }

        if (! empty($this->organizationCode)) {
            $result['organization_code'] = $this->organizationCode;
        }

        // 只有当 options 不为空时才包含该字段
        if (! empty($this->options)) {
            $result['options'] = $this->options;
        }

        // 只有当 stsTemporaryCredential 不为空时才包含该字段
        if (! empty($this->stsTemporaryCredential)) {
            $result['sts_temporary_credential'] = $this->stsTemporaryCredential;
        }

        return $result;
    }
}

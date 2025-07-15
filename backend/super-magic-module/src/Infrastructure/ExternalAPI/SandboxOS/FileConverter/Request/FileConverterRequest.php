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

    public function __construct(string $convertType, array $fileKeys, array $options = [])
    {
        $this->convertType = $convertType;
        $this->fileKeys = $fileKeys;

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

    public function toArray(): array
    {
        $result = [
            'file_keys' => $this->fileKeys,
            'output_format' => $this->outputFormat,
            'is_debug' => $this->isDebug,
            'convert_type' => $this->convertType,
        ];

        // 只有当 options 不为空时才包含该字段
        if (! empty($this->options)) {
            $result['options'] = $this->options;
        }

        return $result;
    }
}

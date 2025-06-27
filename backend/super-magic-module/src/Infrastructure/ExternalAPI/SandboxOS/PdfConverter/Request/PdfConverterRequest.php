<?php

declare(strict_types=1);

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\PdfConverter\Request;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Contract\RequestInterface;

/**
 * PDF 转换请求
 */
class PdfConverterRequest implements RequestInterface
{
    private array $fileKeys = [];
    private array $options = [];
    private string $outputFormat = 'zip';
    private bool $mergePdfs = false;
    private bool $isDebug = false;

    public function __construct(array $fileKeys, array $options = [])
    {
        $this->fileKeys = $fileKeys;

        if (isset($options['is_debug'])) {
            $this->isDebug = (bool) $options['is_debug'];
            unset($options['is_debug']);
        }

        $this->options = array_merge([
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
        ], $options);
    }

    public function toArray(): array
    {
        return [
            'file_keys' => $this->fileKeys,
            'options' => $this->options,
            'output_format' => $this->outputFormat,
            'merge_pdfs' => $this->mergePdfs,
            'is_debug' => $this->isDebug,
        ];
    }
} 
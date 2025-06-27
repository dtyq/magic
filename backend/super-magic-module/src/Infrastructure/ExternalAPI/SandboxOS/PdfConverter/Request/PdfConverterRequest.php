<?php

declare(strict_types=1);

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\PdfConverter\Request;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Contract\RequestInterface;

/**
 * PDF 转换请求
 */
class PdfConverterRequest implements RequestInterface
{
    private array $urls = [];
    private array $options = [];
    private string $outputFormat = 'zip';
    private bool $mergePdfs = false;

    public function __construct(array $urls, array $options = [])
    {
        $this->urls = $urls;
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

    public function getUrls(): array
    {
        return $this->urls;
    }

    public function toArray(): array
    {
        return [
            'urls' => $this->urls,
            'options' => $this->options,
            'output_format' => $this->outputFormat,
            'merge_pdfs' => $this->mergePdfs,
        ];
    }
} 
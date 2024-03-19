<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\OCR;

use App\Infrastructure\Core\Exception\OCRException;
use App\Infrastructure\ExternalAPI\OCR\Config\VolceOCRConfig;
use App\Infrastructure\Util\FileType;
use Hyperf\Codec\Json;
use Hyperf\Logger\LoggerFactory;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
use Volc\Service\Visual;

class VolceOCRClient implements OCRClientInterface
{
    private const int DEFAULT_TIMEOUT = 60;

    private LoggerInterface $logger;

    public function __construct(
        LoggerFactory $loggerFactory,
        private VolceOCRConfig $ocrConfig
    ) {
        $this->logger = $loggerFactory->get('volce_ocr');
    }

    public function ocr(?string $url = null): string
    {
        // 配置特定的 OCR 客户端
        $client = Visual::getInstance();
        $client->setAccessKey($this->ocrConfig->getAccessKey());
        $client->setSecretKey($this->ocrConfig->getSecretKey());
        $client->setAPI('OCRPdf', '2021-08-23');
        $formParams = ['version' => 'v3', 'page_num' => 100];
        $formParams['image_url'] = $url;
        $isPdfOrImage = $this->isPdfOrImage($url);
        if (empty($isPdfOrImage)) {
            throw new InvalidArgumentException('not support file type, support file type is pdf or image');
        }
        $options = [
            'form_params' => $formParams,
            'timeout' => self::DEFAULT_TIMEOUT,
            'file_type' => $isPdfOrImage,
        ];
        $response = $client->CallAPI('OCRPdf', $options);
        $content = $response->getContents();
        $this->logger->info('火山OCR响应: ' . $content);
        $result = Json::decode($content);
        $code = $result['code'] ?? 0; // 如果没有 'code'，则使用默认的错误代码
        if ($code !== 10000) {
            $message = $result['Message'] ?? '火山OCR遇到错误,message 不存在'; // 如果没有 'message'，则使用默认消息
            $this->logger->error(sprintf(
                '火山OCR遇到错误:%s,',
                $message,
            ));
            throw new OCRException($message, $code);
        }
        return $result['data']['markdown'];
    }

    public function isPdfOrImage(string $url): ?string
    {
        $type = FileType::getType($url);
        if ($type === 'pdf') {
            return 'pdf';
        }
        if (in_array($type, ['jpg', 'jpeg', 'png', 'bmp'], true)) {
            return 'image';
        }
        $context = stream_context_create([
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
            ],
        ]);
        // 获取 HTTP 头部信息
        $headers = get_headers($url, true, $context);

        // 检查是否成功获取头部信息
        if ($headers === false || ! isset($headers['Content-Type'])) {
            return null; // 无法获取文件类型
        }

        // 解析 Content-Type
        $contentType = is_array($headers['Content-Type']) ? $headers['Content-Type'][0] : $headers['Content-Type'];

        // 检查文件类型是否为 PDF 或图片
        if ($contentType === 'application/pdf') {
            return 'pdf';
        }
        if (in_array($contentType, ['image/jpeg', 'image/jpg', 'image/png', 'image/bmp'], true)) {
            return 'image';
        }

        return null; // 既不是 PDF 也不是指定的图片格式
    }
}

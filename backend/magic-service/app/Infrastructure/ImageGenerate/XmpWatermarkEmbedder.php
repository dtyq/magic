<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ImageGenerate;

use App\Domain\ImageGenerate\ValueObject\ImplicitWatermark;
use Exception;
use Psr\Log\LoggerInterface;

class XmpWatermarkEmbedder
{
    public function __construct(
        private LoggerInterface $logger
    ) {
    }

    public function embedWatermarkToImageData(string $imageData, ImplicitWatermark $watermark): string
    {
        try {
            $format = $this->detectImageFormat($imageData);

            switch ($format) {
                case 'jpeg':
                    return $this->embedXmpToJpeg($imageData, $watermark);
                case 'png':
                    return $this->embedXmpToPng($imageData, $watermark);
                case 'webp':
                    return $this->embedXmpToWebp($imageData, $watermark);
                default:
                    // 不支持的格式转换为PNG后嵌入XMP
                    $this->logger->info("Converting unsupported format '{$format}' to PNG for XMP embedding");
                    return $this->convertToPngAndEmbed($imageData, $watermark);
            }
        } catch (Exception $e) {
            $this->logger->error('XMP embedding failed', [
                'error' => $e->getMessage(),
            ]);
            return $imageData;
        }
    }

    public function embedWatermarkToImageUrl(string $imageUrl, ImplicitWatermark $watermark): string
    {
        try {
            $imageData = $this->downloadImageFromUrl($imageUrl);
            return $this->embedWatermarkToImageData($imageData, $watermark);
        } catch (Exception $e) {
            $this->logger->error('XMP embedding from URL failed', [
                'error' => $e->getMessage(),
                'url' => $imageUrl,
            ]);
            return $imageData ?? '';
        }
    }

    public function extractWatermarkFromImageData(string $imageData): ?array
    {
        try {
            $format = $this->detectImageFormat($imageData);

            switch ($format) {
                case 'jpeg':
                    return $this->extractXmpFromJpeg($imageData);
                case 'png':
                    return $this->extractXmpFromPng($imageData);
                default:
                    return null;
            }
        } catch (Exception $e) {
            $this->logger->error('XMP extraction failed', [
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    public function extractWatermarkFromImageUrl(string $imageUrl): ?array
    {
        try {
            $imageData = $this->downloadImageFromUrl($imageUrl);
            return $this->extractWatermarkFromImageData($imageData);
        } catch (Exception $e) {
            $this->logger->error('XMP extraction from URL failed', [
                'error' => $e->getMessage(),
                'url' => $imageUrl,
            ]);
            return null;
        }
    }

    private function embedXmpToJpeg(string $imageData, ImplicitWatermark $watermark): string
    {
        $xmpData = $this->generateXmpData($watermark);

        // 查找 APP1 段（EXIF/XMP）的位置
        $pos = 2; // 跳过 JPEG 文件头 (FF D8)

        // 查找合适的位置插入 XMP 段
        while ($pos < strlen($imageData) - 1) {
            $marker = ord($imageData[$pos]) << 8 | ord($imageData[$pos + 1]);

            if ($marker >= 0xFFE1 && $marker <= 0xFFEF) { // APP1-APP15
                $segmentLength = ord($imageData[$pos + 2]) << 8 | ord($imageData[$pos + 3]);

                // 检查是否为 XMP 段
                if (substr($imageData, $pos + 4, 28) === 'http://ns.adobe.com/xap/1.0/') {
                    // 已有 XMP 段，需要合并
                    return $this->mergeXmpInJpeg($imageData, $pos, $segmentLength, $xmpData);
                }

                $pos += 2 + $segmentLength;
            } else {
                // 找到非APP段，在这里插入 XMP
                return $this->insertXmpInJpeg($imageData, $pos, $xmpData);
            }
        }

        // 如果没找到合适位置，在文件开头插入
        return $this->insertXmpInJpeg($imageData, 2, $xmpData);
    }

    private function embedXmpToPng(string $imageData, ImplicitWatermark $watermark): string
    {
        $xmpData = $this->generateXmpData($watermark);

        // PNG 文件结构：8字节签名 + IHDR + 其他块 + IEND
        $signature = substr($imageData, 0, 8);

        if ($signature !== "\x89PNG\r\n\x1a\n") {
            throw new Exception('Invalid PNG file signature');
        }

        $pos = 8; // 跳过PNG签名
        $chunks = [];
        $xmpChunkFound = false;
        $xmpChunkIndex = -1;

        // 解析现有块
        while ($pos < strlen($imageData) - 8) {
            $chunkLength = unpack('N', substr($imageData, $pos, 4))[1];
            $chunkType = substr($imageData, $pos + 4, 4);
            $chunkData = substr($imageData, $pos + 8, $chunkLength);
            $chunkCrc = substr($imageData, $pos + 8 + $chunkLength, 4);

            // 检查是否为现有的 XMP tEXt 块
            if ($chunkType === 'tEXt' && strpos($chunkData, "XML:com.adobe.xmp\0") === 0) {
                $xmpChunkFound = true;
                $xmpChunkIndex = count($chunks);
                // 替换现有的 XMP 块
                $chunks[] = [
                    'type' => 'tEXt',
                    'data' => "XML:com.adobe.xmp\0" . $xmpData,
                    'crc' => null, // 将重新计算
                ];
            } else {
                $chunks[] = [
                    'type' => $chunkType,
                    'data' => $chunkData,
                    'crc' => $chunkCrc,
                ];
            }

            $pos += 8 + $chunkLength + 4;

            // 在关键块后插入新的 XMP 文本块（仅当没有找到现有XMP块时）
            if ($chunkType === 'IHDR' && ! $xmpChunkFound) {
                $chunks[] = [
                    'type' => 'tEXt',
                    'data' => "XML:com.adobe.xmp\0" . $xmpData,
                    'crc' => null, // 将重新计算
                ];
            }
        }

        return $this->rebuildPng($signature, $chunks);
    }

    private function embedXmpToWebp(string $imageData, ImplicitWatermark $watermark): string
    {
        $xmpData = $this->generateXmpData($watermark);

        // WebP文件结构：RIFF header + WebP chunks
        if (substr($imageData, 0, 4) !== 'RIFF' || substr($imageData, 8, 4) !== 'WEBP') {
            throw new Exception('Invalid WebP file format');
        }

        // WebP格式复杂，暂时转换为PNG处理
        $this->logger->info('Converting WebP to PNG for XMP embedding');
        return $this->convertToPngAndEmbed($imageData, $watermark);
    }

    private function convertToPngAndEmbed(string $imageData, ImplicitWatermark $watermark): string
    {
        // 从原始数据创建图片资源
        $image = imagecreatefromstring($imageData);
        if ($image === false) {
            throw new Exception('无法从不支持格式创建图片资源');
        }

        // 获取图片尺寸
        $width = imagesx($image);
        $height = imagesy($image);

        // 创建PNG图片资源
        $pngImage = imagecreatetruecolor($width, $height);

        // 保持透明度支持
        imagealphablending($pngImage, false);
        imagesavealpha($pngImage, true);

        // 填充透明背景
        $transparent = imagecolorallocatealpha($pngImage, 0, 0, 0, 127);
        imagefill($pngImage, 0, 0, $transparent);

        // 复制原图到新的PNG图片
        imagealphablending($pngImage, true);
        imagecopy($pngImage, $image, 0, 0, 0, 0, $width, $height);

        // 输出PNG格式数据
        ob_start();
        imagepng($pngImage, null, 0); // PNG无损压缩
        $pngData = ob_get_contents();
        ob_end_clean();

        // 清理内存
        imagedestroy($image);
        imagedestroy($pngImage);

        // 对转换后的PNG数据嵌入XMP
        return $this->embedXmpToPng($pngData, $watermark);
    }

    private function generateXmpData(ImplicitWatermark $watermark): string
    {
        // 将ImplicitWatermark对象转换为JSON
        $watermarkData = $watermark->toArray();
        $watermarkJson = htmlspecialchars(json_encode($watermarkData), ENT_XML1, 'UTF-8');

        return <<<XML
<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Magic AI XMP Core 1.0">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:magic="http://magic.ai/xmp/1.0/">
      <magic:AIGC>{$watermarkJson}</magic:AIGC>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>
XML;
    }

    private function insertXmpInJpeg(string $imageData, int $insertPos, string $xmpData): string
    {
        $xmpSegment = $this->createJpegXmpSegment($xmpData);

        return substr($imageData, 0, $insertPos)
               . $xmpSegment
               . substr($imageData, $insertPos);
    }

    private function mergeXmpInJpeg(string $imageData, int $xmpPos, int $xmpLength, string $newXmpData): string
    {
        // 暂时简单替换现有XMP段
        $before = substr($imageData, 0, $xmpPos);
        $after = substr($imageData, $xmpPos + 2 + $xmpLength);
        $newXmpSegment = $this->createJpegXmpSegment($newXmpData);

        return $before . $newXmpSegment . $after;
    }

    private function createJpegXmpSegment(string $xmpData): string
    {
        $xmpIdentifier = 'http://ns.adobe.com/xap/1.0/' . "\0";
        $segmentData = $xmpIdentifier . $xmpData;
        $segmentLength = strlen($segmentData);

        if ($segmentLength > 65533) { // APP1 最大长度
            throw new Exception('XMP data too large for JPEG segment');
        }

        return "\xFF\xE1" . pack('n', $segmentLength + 2) . $segmentData;
    }

    private function rebuildPng(string $signature, array $chunks): string
    {
        $result = $signature;

        foreach ($chunks as $chunk) {
            $length = strlen($chunk['data']);
            $crc = $chunk['crc'] ?? pack('N', crc32($chunk['type'] . $chunk['data']));

            $result .= pack('N', $length)
                      . $chunk['type']
                      . $chunk['data']
                      . $crc;
        }

        return $result;
    }

    private function detectImageFormat(string $imageData): string
    {
        $info = getimagesizefromstring($imageData);
        if ($info === false) {
            return 'unknown';
        }

        return match ($info[2]) {
            IMAGETYPE_JPEG => 'jpeg',
            IMAGETYPE_PNG => 'png',
            IMAGETYPE_WEBP => 'webp',
            IMAGETYPE_GIF => 'gif',
            default => 'unknown',
        };
    }

    private function extractXmpFromJpeg(string $imageData): ?array
    {
        $pos = 2;

        while ($pos < strlen($imageData) - 1) {
            $marker = ord($imageData[$pos]) << 8 | ord($imageData[$pos + 1]);

            if ($marker >= 0xFFE1 && $marker <= 0xFFEF) {
                $segmentLength = ord($imageData[$pos + 2]) << 8 | ord($imageData[$pos + 3]);

                if (substr($imageData, $pos + 4, 28) === 'http://ns.adobe.com/xap/1.0/') {
                    $xmpData = substr($imageData, $pos + 33, $segmentLength - 31);
                    return $this->parseXmpData($xmpData);
                }

                $pos += 2 + $segmentLength;
            } else {
                break;
            }
        }

        return null;
    }

    private function extractXmpFromPng(string $imageData): ?array
    {
        $pos = 8; // 跳过PNG签名

        while ($pos < strlen($imageData) - 8) {
            $chunkLength = unpack('N', substr($imageData, $pos, 4))[1];
            $chunkType = substr($imageData, $pos + 4, 4);
            $chunkData = substr($imageData, $pos + 8, $chunkLength);

            if ($chunkType === 'tEXt' && strpos($chunkData, "XML:com.adobe.xmp\0") === 0) {
                $xmpData = substr($chunkData, 18); // 跳过 "XML:com.adobe.xmp\0"
                return $this->parseXmpData($xmpData);
            }

            $pos += 8 + $chunkLength + 4;
        }

        return null;
    }

    private function parseXmpData(string $xmpData): ?array
    {
        // 解析新的AIGC字段结构
        $pattern = '/<magic:AIGC[^>]*>([^<]+)<\/magic:AIGC>/';

        if (preg_match($pattern, $xmpData, $matches)) {
            $jsonData = html_entity_decode($matches[1], ENT_XML1, 'UTF-8');
            $decodedData = json_decode($jsonData, true);

            if (json_last_error() === JSON_ERROR_NONE && is_array($decodedData)) {
                return $decodedData;
            }
        }

        return null;
    }

    private function downloadImageFromUrl(string $url): string
    {
        $context = stream_context_create([
            'http' => [
                'timeout' => 10,
                'user_agent' => 'Magic-Service/1.0',
            ],
        ]);

        $imageData = file_get_contents($url, false, $context);
        if ($imageData === false) {
            throw new Exception('无法下载图片: ' . $url);
        }

        return $imageData;
    }
}

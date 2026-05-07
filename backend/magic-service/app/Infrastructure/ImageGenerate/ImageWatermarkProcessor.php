<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ImageGenerate;

use App\Domain\File\Repository\Persistence\CloudFileRepository;
use App\Domain\File\Service\FileDomainService;
use App\Domain\ImageGenerate\Contract\FontProviderInterface;
use App\Domain\ImageGenerate\Contract\ImageEnhancementProcessorInterface;
use App\Domain\ImageGenerate\ValueObject\ImplicitWatermark;
use App\Domain\ImageGenerate\ValueObject\WatermarkConfig;
use App\ErrorCode\ImageGenerateErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\Traits\HasLogger;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Hyperf\Codec\Json;
use Hyperf\Di\Annotation\Inject;
use Throwable;

/**
 * 图片水印处理器
 * 统一处理各种格式图片的水印添加.
 */
class ImageWatermarkProcessor
{
    use HasLogger;

    public const WATERMARK_TEXT = '麦吉 AI 生成';

    #[Inject]
    protected FontProviderInterface $fontProvider;

    #[Inject]
    protected ImageEnhancementProcessorInterface $imageEnhancementProcessor;

    /**
     * 为base64格式图片添加水印.
     */
    public function addWatermarkToBase64(string $base64Image, ImageGenerateRequest $imageGenerateRequest): string
    {
        // 检测原始格式
        $originalFormat = $this->extractBase64Format($base64Image);

        // 解码base64图片
        $imageData = $this->decodeBase64Image($base64Image);

        // 双重检测确保格式准确
        $detectedFormat = $this->detectImageFormat($imageData);
        $targetFormat = $originalFormat !== 'jpeg' ? $originalFormat : $detectedFormat;

        // 使用统一的水印处理方法
        if ($imageGenerateRequest->isAddWatermark()) {
            $this->addWaterMarkHandler($imageData, $imageGenerateRequest, $targetFormat);
        }

        // 立即添加隐式水印
        $implicitWatermark = $imageGenerateRequest->getImplicitWatermark();
        if ($implicitWatermark !== null) {
            $this->imageEnhancementProcessor->enhanceImageData($imageData, $implicitWatermark);
            $this->logger->info('【AIGC】隐式水印处理完成(Base64格式)');
        }

        // 重新编码为base64并上传
        $outputPrefix = $this->generateBase64Prefix($targetFormat);
        return $this->processBase64Images($outputPrefix . base64_encode($imageData), $imageGenerateRequest);
    }

    /**
     * 为URL格式图片添加水印
     * 可选择返回格式：URL 或 base64.
     */
    public function addWatermarkToUrl(string $imageUrl, ImageGenerateRequest $imageGenerateRequest): string
    {
        $imageData = $this->downloadImage($imageUrl);

        if ($imageGenerateRequest->isAddWatermark()) {
            $this->addWaterMarkHandler($imageData, $imageGenerateRequest);
        }

        // 立即添加XMP隐式水印
        $implicitWatermark = $imageGenerateRequest->getImplicitWatermark();
        if ($implicitWatermark !== null) {
            $this->imageEnhancementProcessor->enhanceImageData($imageData, $implicitWatermark);
            $this->logger->info('【AIGC】隐式水印处理完成(URL格式)', [
                'original_url' => substr($imageUrl, 0, 255),
            ]);
        }

        // 根据处理后的真实图片二进制重新检测格式，避免 PNG 被错误包装成 image/jpeg。
        $outputFormat = $this->detectImageFormat($imageData);
        $outputPrefix = $this->generateBase64Prefix($outputFormat);
        return $this->processBase64Images($outputPrefix . base64_encode($imageData), $imageGenerateRequest);
    }

    public function extractWatermarkInfo(string $imageUrl): ?array
    {
        try {
            $imageData = $this->downloadImage($imageUrl);
            return $this->imageEnhancementProcessor->extractEnhancementFromImageData($imageData);
        } catch (Throwable $e) {
            $this->logger->error('Failed to extract watermark info', [
                'error' => $e->getMessage(),
                'url' => $imageUrl,
            ]);
            return null;
        }
    }

    /**
     * 对本地文件执行可见水印和隐式水印处理，处理结果直接回写原文件。
     */
    public function processLocalFile(
        string $localFilePath,
        ?WatermarkConfig $watermarkConfig,
        ?ImplicitWatermark $implicitWatermark,
    ): void {
        $imageData = file_get_contents($localFilePath);
        if ($imageData === false) {
            ExceptionBuilder::throw(ImageGenerateErrorCode::IMAGE_DOWNLOAD_FAILED);
        }

        $detectedFormat = $this->detectImageFormat($imageData);
        $this->applyWatermarks(
            $imageData,
            $watermarkConfig,
            $implicitWatermark,
            $detectedFormat,
            'LocalFile格式',
            ['local_file_path' => $localFilePath],
        );

        if (file_put_contents($localFilePath, $imageData) === false) {
            ExceptionBuilder::throw(ImageGenerateErrorCode::IMAGE_DOWNLOAD_FAILED);
        }
    }

    /**
     * 为图片添加水印（通过引用直接修改原始数据）.
     * @param string $imageData 图片二进制数据，会被直接修改
     * @param ImageGenerateRequest $imageGenerateRequest 图片生成请求
     * @param null|string $format 图片格式（可选，不传则自动检测）
     */
    protected function addWaterMarkHandler(string &$imageData, ImageGenerateRequest $imageGenerateRequest, ?string $format = null): void
    {
        $this->applyVisibleWatermark($imageData, $imageGenerateRequest->getWatermarkConfig(), $format);
    }

    /**
     * 为图片资源添加水印.
     * @param mixed $image
     */
    private function addWatermarkToImageResource($image, WatermarkConfig $config)
    {
        $width = imagesx($image);
        $height = imagesy($image);

        // 创建新图片资源以避免修改原图
        $watermarkedImage = imagecreatetruecolor($width, $height);

        // 先用全透明画布初始化，避免透明区域在拷贝时落成黑底
        imagealphablending($watermarkedImage, false);
        imagesavealpha($watermarkedImage, true);
        $transparent = imagecolorallocatealpha($watermarkedImage, 0, 0, 0, 127);
        imagefill($watermarkedImage, 0, 0, $transparent);

        imagecopy($watermarkedImage, $image, 0, 0, 0, 0, $width, $height);
        imagealphablending($watermarkedImage, true);

        // 添加文字水印
        $this->addTextWatermark($watermarkedImage, $config, $width, $height);

        return $watermarkedImage;
    }

    /**
     * 添加文字水印.
     * @param mixed $image
     */
    private function addTextWatermark($image, WatermarkConfig $config, int $width, int $height): void
    {
        $text = $config->getLogotextContent();
        $fontSize = $this->calculateFontSize($width, $height);
        $fontColor = $this->createTransparentColor($image, $config->getOpacity());

        // 计算水印位置
        [$x, $y] = $this->calculateWatermarkPosition($width, $height, $text, $fontSize, $config->getPosition());

        // 优先使用TTF字体，特别是对于中文文本
        $fontFile = $this->fontProvider->getFontPath();
        if ($fontFile !== null && ($this->fontProvider->containsChinese($text) || $this->fontProvider->supportsTTF())) {
            // 使用TTF字体渲染，支持中文
            // TTF字体大小需要调整，通常比内置字体小一些
            $ttfFontSize = max(12, (int) ($fontSize * 1.0));

            // 正确计算TTF字体的基线位置
            if (function_exists('imagettfbbox')) {
                // 直接使用传入的Y坐标作为基线位置
                $ttfY = $y;
            } else {
                // 如果无法获取边界框，直接使用传入的Y坐标
                $ttfY = $y;
            }

            imagettftext($image, $ttfFontSize, 0, $x, $ttfY, $fontColor, $fontFile, $text);
        } else {
            // 降级使用内置字体（仅支持ASCII字符）
            // 内置字体的Y坐标是文字顶部，需要从基线位置转换
            $builtinY = $y - (int) ($fontSize * 0.8); // 从基线位置转换为顶部位置
            imagestring($image, 5, $x, $builtinY, $text, $fontColor);

            // 如果文本包含中文但没有TTF字体，记录警告
            if ($this->fontProvider->containsChinese($text)) {
                $this->logger->warning('Chinese text detected but TTF font not available, may display incorrectly');
            }
        }
    }

    /**
     * 计算字体大小.
     */
    private function calculateFontSize(int $width, int $height): int
    {
        // 根据图片大小动态调整字体大小
        $size = min($width, $height) / 10;
        return max(24, min(72, (int) $size));
    }

    /**
     * 创建透明颜色.
     * @param mixed $image
     */
    private function createTransparentColor($image, float $opacity): int
    {
        // 创建白色半透明水印
        $alpha = (int) ((1 - $opacity) * 127);
        return imagecolorallocatealpha($image, 255, 255, 255, $alpha);
    }

    /**
     * 计算水印位置.
     */
    private function calculateWatermarkPosition(int $width, int $height, string $text, int $fontSize, int $position): array
    {
        // 更精确的文字宽度估算
        $fontFile = $this->fontProvider->getFontPath();
        if ($fontFile !== null && $this->fontProvider->supportsTTF() && function_exists('imagettfbbox')) {
            // 使用TTF字体计算实际文本边界框
            $ttfFontSize = max(8, (int) ($fontSize * 0.8));
            $bbox = imagettfbbox($ttfFontSize, 0, $fontFile, $text);
            $textWidth = (int) (($bbox[4] - $bbox[0]) * 1.2);  // 增加20%安全边距
            $textHeight = (int) abs($bbox[1] - $bbox[7]); // 使用绝对值确保高度为正

            // TTF字体的下降部分（descender）
            $descender = (int) abs($bbox[1]); // 基线以下的部分
            $ascender = (int) abs($bbox[7]);  // 基线以上的部分
            $totalTextHeight = $descender + $ascender;
        } else {
            // 降级使用估算方法
            // 对于中文字符，每个字符宽度约等于字体大小
            $chineseCharCount = mb_strlen($text, 'UTF-8');
            $textWidth = (int) ($chineseCharCount * $fontSize * 1.0); // 增加安全边距
            $textHeight = $fontSize;
            $descender = (int) ($fontSize * 0.2); // 内置字体估算下降部分
            $ascender = (int) ($fontSize * 0.8); // 内置字体估算上升部分
            $totalTextHeight = $textHeight;
        }

        // 动态边距：基于字体大小计算，确保足够的空间
        $margin = max(20, (int) ($fontSize * 0.8));

        switch ($position) {
            case 1: // 左上角
                return [$margin, $margin + $ascender];
            case 2: // 上方中央
                return [max($margin, (int) (($width - $textWidth) / 2)), $margin + $ascender];
            case 3: // 右上角
                return [max($margin, $width - $textWidth - $margin), $margin + $ascender];
            case 4: // 左侧中央
                return [$margin, (int) (($height + $ascender - $descender) / 2)];
            case 5: // 中央
                return [max($margin, (int) (($width - $textWidth) / 2)), (int) (($height + $ascender - $descender) / 2)];
            case 6: // 右侧中央
                return [max($margin, $width - $textWidth - $margin), (int) (($height + $ascender - $descender) / 2)];
            case 7: // 左下角
                return [$margin, $height - $margin - $descender];
            case 8: // 下方中央
                return [max($margin, (int) (($width - $textWidth) / 2)), $height - $margin - $descender];
            case 9: // 右下角
                return [max($margin, $width - $textWidth - $margin), $height - $margin - $descender];
            default: // 默认右下角
                return [max($margin, $width - $textWidth - $margin), $height - $margin - $descender];
        }
    }

    /**
     * 解码base64图片数据.
     */
    private function decodeBase64Image(string $base64Image): string
    {
        // 移除data URL前缀
        if (str_contains($base64Image, ',')) {
            $base64Image = substr($base64Image, strpos($base64Image, ',') + 1);
        }

        $imageData = base64_decode($base64Image);
        if ($imageData === false) {
            ExceptionBuilder::throw(ImageGenerateErrorCode::INVALID_BASE64_IMAGE);
        }

        return $imageData;
    }

    /**
     * 下载网络图片.
     */
    private function downloadImage(string $url): string
    {
        $context = stream_context_create([
            'http' => [
                'timeout' => 10,
                'user_agent' => 'Magic-Service/1.0',
            ],
        ]);

        $imageData = file_get_contents($url, false, $context);
        if ($imageData === false) {
            ExceptionBuilder::throw(ImageGenerateErrorCode::IMAGE_DOWNLOAD_FAILED);
        }

        return $imageData;
    }

    /**
     * 输出图片（无损版本）.
     * @param mixed $image
     * @param string $format 目标格式 (png/jpeg/webp/gif)
     */
    private function outputImage($image, string $format = 'auto'): void
    {
        // 自动格式检测
        if ($format === 'auto') {
            if ($this->fontProvider->hasTransparency($image)) {
                $format = 'png'; // 有透明度使用PNG
            } else {
                $format = 'jpeg'; // 无透明度使用JPEG高质量
            }
        }

        try {
            switch (strtolower($format)) {
                case 'png':
                    imagepng($image, null, 0); // PNG无损压缩
                    break;
                case 'webp':
                    if (function_exists('imagewebp')) {
                        imagewebp($image, null, 100); // WebP无损模式
                    } else {
                        $this->logger->warning('WebP not supported, falling back to PNG');
                        imagepng($image, null, 0);
                    }
                    break;
                case 'gif':
                    // GIF限制较多，建议升级为PNG
                    $this->logger->info('Converting GIF to PNG for better quality');
                    imagepng($image, null, 0);
                    break;
                case 'jpeg':
                case 'jpg':
                default:
                    if ($this->fontProvider->hasTransparency($image)) {
                        // JPEG不支持透明度，自动转PNG
                        $this->logger->info('JPEG does not support transparency, converting to PNG');
                        imagepng($image, null, 0);
                    } else {
                        imagejpeg($image, null, 100); // JPEG最高质量
                    }
                    break;
            }
        } catch (Throwable $e) {
            // 编码失败时使用PNG兜底
            $this->logger->error('Image encoding failed, falling back to PNG', [
                'format' => $format,
                'error' => $e->getMessage(),
            ]);
            imagepng($image, null, 0);
        }
    }

    /**
     * 检测图像数据的格式.
     */
    private function detectImageFormat(string $imageData): string
    {
        $info = getimagesizefromstring($imageData);
        if ($info === false) {
            $this->logger->warning('Unable to detect image format, defaulting to jpeg');
            return 'jpeg';
        }

        return match ($info[2]) {
            IMAGETYPE_PNG => 'png',
            IMAGETYPE_WEBP => 'webp',
            IMAGETYPE_GIF => 'gif',
            IMAGETYPE_JPEG => 'jpeg',
            default => 'jpeg',
        };
    }

    /**
     * 从base64前缀提取图像格式.
     */
    private function extractBase64Format(string $base64Image): string
    {
        if (str_contains($base64Image, ',')) {
            $prefix = substr($base64Image, 0, strpos($base64Image, ','));

            if (str_contains($prefix, 'image/png')) {
                return 'png';
            }
            if (str_contains($prefix, 'image/webp')) {
                return 'webp';
            }
            if (str_contains($prefix, 'image/gif')) {
                return 'gif';
            }
            if (str_contains($prefix, 'image/jpeg') || str_contains($prefix, 'image/jpg')) {
                return 'jpeg';
            }
        }

        // 默认返回jpeg
        return 'jpeg';
    }

    /**
     * 根据格式生成base64前缀.
     */
    private function generateBase64Prefix(string $format): string
    {
        return match (strtolower($format)) {
            'png' => 'data:image/png;base64,',
            'webp' => 'data:image/webp;base64,',
            'gif' => 'data:image/gif;base64,',
            'jpeg', 'jpg' => 'data:image/jpeg;base64,',
            default => 'data:image/jpeg;base64,',
        };
    }

    private function processBase64Images(string $base64Image, ImageGenerateRequest $imageGenerateRequest): string
    {
        $organizationCode = CloudFileRepository::DEFAULT_ICON_ORGANIZATION_CODE;
        $fileDomainService = di(FileDomainService::class);
        try {
            $subDir = 'open';

            // 直接使用已包含XMP水印的base64数据
            $uploadFile = new UploadFile($base64Image, $subDir, '');

            $fileDomainService->uploadByCredential($organizationCode, $uploadFile, StorageBucketType::Public);

            $fileLink = $fileDomainService->getLink($organizationCode, $uploadFile->getKey(), StorageBucketType::Public);

            // 设置对象元数据作为备用方案
            $validityPeriod = $imageGenerateRequest->getValidityPeriod();
            $metadataContent = [];
            if ($validityPeriod !== null) {
                $metadataContent['validity_period'] = (string) $validityPeriod;
            }
            $metadata = ['metadata' => Json::encode($metadataContent)];

            $fileDomainService->setHeadObjectByCredential($organizationCode, $uploadFile->getKey(), $metadata, StorageBucketType::Public);

            return $fileLink->getUrl();
        } catch (Throwable $e) {
            $this->logger->error('Failed to process base64 image', [
                'error' => $e->getMessage(),
                'organization_code' => $organizationCode,
            ]);
            // If upload fails, keep the original base64 data
            $processedImage = $base64Image;
        }
        return $processedImage;
    }

    private function applyWatermarks(
        string &$imageData,
        ?WatermarkConfig $watermarkConfig,
        ?ImplicitWatermark $implicitWatermark,
        ?string $format = null,
        string $scene = '',
        array $logContext = [],
    ): void {
        if ($watermarkConfig !== null) {
            $this->applyVisibleWatermark($imageData, $watermarkConfig, $format);
        }

        if ($implicitWatermark !== null) {
            $this->imageEnhancementProcessor->enhanceImageData($imageData, $implicitWatermark);
            $this->logger->info('【AIGC】隐式水印处理完成(' . $scene . ')', $logContext);
        }
    }

    private function applyVisibleWatermark(
        string &$imageData,
        ?WatermarkConfig $watermarkConfig,
        ?string $format = null,
    ): void {
        if ($watermarkConfig === null) {
            return;
        }

        // 检测图片格式，优先使用传入的格式
        $detectedFormat = $format ?? $this->detectImageFormat($imageData);

        $image = imagecreatefromstring($imageData);
        if ($image === false) {
            ExceptionBuilder::throw(ImageGenerateErrorCode::INVALID_IMAGE_DATA);
        }

        $watermarkedImage = $this->addWatermarkToImageResource($image, $watermarkConfig);

        ob_start();
        $this->outputImage($watermarkedImage, $detectedFormat);
        $watermarkedData = ob_get_contents();
        ob_end_clean();

        imagedestroy($image);
        imagedestroy($watermarkedImage);

        if ($watermarkedData === false) {
            ExceptionBuilder::throw(ImageGenerateErrorCode::WATERMARK_OUTPUT_FAILED);
        }

        $imageData = $watermarkedData;
    }
}

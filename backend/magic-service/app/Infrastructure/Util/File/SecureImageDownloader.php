<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\File;

use App\Infrastructure\ExternalAPI\Image\ImageAsset;
use App\Infrastructure\Util\Http\GuzzleClientFactory;
use App\Infrastructure\Util\SSRF\SSRFUtil;
use GuzzleHttp\RequestOptions;
use InvalidArgumentException;
use Psr\Http\Message\ResponseInterface;
use RuntimeException;
use Throwable;

/**
 * 安全下载远程图片。该下载器负责对输入资源做统一的 SSRF、大小和文件类型约束。
 */
class SecureImageDownloader
{
    private const MAX_IMAGE_SIZE = 20 * 1024 * 1024;

    public function __construct(
        private readonly ImageFileInspector $imageFileInspector,
    ) {
    }

    /**
     * 下载并校验远程图片，成功后返回临时文件信息；失败时自动清理临时文件。
     *
     * @param array<string> $blackList
     */
    /**
     * @param bool $checkHeaderMimeType 是否通过响应头 Content-Type 做 MIME 预检。
     *                                  对于 TOS 等对象存储的文件，上传时可能未设置正确的 Content-Type（如 application/octet-stream），
     *                                  此时应传 false，由下载后的魔法字节检测（assertImageFile）来保障格式合法性。
     */
    public function download(string $imageUrl, array $blackList = [], bool $checkHeaderMimeType = true): ImageAsset
    {
        $safeUrl = SSRFUtil::getSafeUrl($imageUrl, blackList: $blackList, replaceIp: false);
        try {
            $tempFile = TemporaryFileManager::createTempFile('image_download_');
        } catch (RuntimeException) {
            throw new InvalidArgumentException('image_generate.create_temp_file_failed');
        }

        try {
            $headers = $this->fetchHeaders($safeUrl);
            $this->assertHeaderContentLength($headers);
            if ($checkHeaderMimeType) {
                $this->assertHeaderMimeType($headers);
            }

            $this->downloadToLocalFile($safeUrl, $tempFile);

            $size = filesize($tempFile);
            if (! is_int($size) || $size <= 0) {
                throw new InvalidArgumentException('image_generate.download_file_empty');
            }
            if ($size > self::MAX_IMAGE_SIZE) {
                throw new InvalidArgumentException('image_generate.remove_background_image_too_large');
            }

            $mimeType = $this->imageFileInspector->assertImageFile($tempFile);

            return ImageAsset::fromLocalFile($tempFile, $mimeType, size: $size);
        } catch (Throwable $throwable) {
            if (is_file($tempFile)) {
                @unlink($tempFile);
            }
            throw $throwable;
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function fetchHeaders(string $safeUrl): array
    {
        $headers = get_headers($safeUrl, true);
        if (! is_array($headers) || $headers === []) {
            throw new InvalidArgumentException('image_generate.image_download_failed');
        }

        return $headers;
    }

    /**
     * 预检 Content-Length，能在下载前拒绝超大文件，降低资源耗尽风险。
     *
     * @param array<string, mixed> $headers
     */
    private function assertHeaderContentLength(array $headers): void
    {
        $contentLength = $headers['Content-Length'] ?? $headers['content-length'] ?? null;
        if (is_array($contentLength)) {
            $contentLength = end($contentLength);
        }

        if ($contentLength === null || $contentLength === '') {
            return;
        }

        if ((int) $contentLength > self::MAX_IMAGE_SIZE) {
            throw new InvalidArgumentException('image_generate.remove_background_image_too_large');
        }
    }

    /**
     * 如果响应头已经明确声明为非图片，则直接拒绝，避免无意义下载。
     *
     * @param array<string, mixed> $headers
     */
    private function assertHeaderMimeType(array $headers): void
    {
        $contentType = $headers['Content-Type'] ?? $headers['content-type'] ?? null;
        if (is_array($contentType)) {
            $contentType = end($contentType);
        }

        if (! is_string($contentType) || $contentType === '') {
            return;
        }

        $contentType = strtolower(trim(explode(';', $contentType)[0] ?? ''));
        if ($contentType !== '' && ! str_starts_with($contentType, 'image/')) {
            throw new InvalidArgumentException('image_generate.remove_background_only_image_allowed');
        }
    }

    /**
     * 采用流式下载，并在下载过程中实时限制大小，避免无 Content-Length 场景失控。
     */
    private function downloadToLocalFile(string $safeUrl, string $tempFile): void
    {
        $client = GuzzleClientFactory::createProxyClient([
            RequestOptions::VERIFY => false,
            'http_errors' => false,
        ]);

        try {
            $response = $client->get($safeUrl, [
                RequestOptions::HEADERS => [
                    'Accept' => 'image/*',
                ],
                RequestOptions::SINK => $tempFile,
                RequestOptions::ON_HEADERS => function (ResponseInterface $response) {
                    $contentLength = $response->getHeaderLine('Content-Length');
                    if ($contentLength !== '' && (int) $contentLength > self::MAX_IMAGE_SIZE) {
                        throw new RuntimeException('image_generate.remove_background_image_too_large');
                    }
                },
                RequestOptions::PROGRESS => function (
                    int $downloadTotal,
                    int $downloadedBytes,
                    int $uploadTotal,
                    int $uploadedBytes
                ) {
                    if ($downloadedBytes > self::MAX_IMAGE_SIZE) {
                        // 在 cURL 回调中抛出异常可能会导致 PHP Warning，
                        // 但它确实能中断下载。我们用 RuntimeException 包装一下，
                        // 外层捕获后再转为业务异常。
                        throw new RuntimeException('image_generate.remove_background_image_too_large');
                    }
                },
            ]);
        } catch (Throwable $e) {
            // 捕获所有异常，包括 Guzzle 的 RequestException 和我们在回调里抛出的异常
            $message = $e->getMessage();
            $previous = $e->getPrevious();

            if (
                str_contains($message, 'image_generate.remove_background_image_too_large')
                || ($previous && str_contains($previous->getMessage(), 'image_generate.remove_background_image_too_large'))
            ) {
                throw new InvalidArgumentException('image_generate.remove_background_image_too_large');
            }

            throw new InvalidArgumentException('image_generate.image_download_failed');
        }

        if ($response->getStatusCode() < 200 || $response->getStatusCode() >= 300) {
            throw new InvalidArgumentException('image_generate.image_download_failed');
        }
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\File\Parser;

use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\File\Parser\Driver\Interfaces\ExcelFileParserDriverInterface;
use App\Infrastructure\Core\File\Parser\Driver\Interfaces\FileParserDriverInterface;
use App\Infrastructure\Core\File\Parser\Driver\Interfaces\OcrFileParserDriverInterface;
use App\Infrastructure\Core\File\Parser\Driver\Interfaces\PdfFileParserDriverInterface;
use App\Infrastructure\Core\File\Parser\Driver\Interfaces\TextFileParserDriverInterface;
use App\Infrastructure\Core\File\Parser\Driver\Interfaces\WordFileParserDriverInterface;
use App\Infrastructure\Util\FileType;
use App\Infrastructure\Util\SSRF\SSRFUtil;
use App\Infrastructure\Util\Text\TextPreprocess\TextPreprocessUtil;
use App\Infrastructure\Util\Text\TextPreprocess\ValueObject\TextPreprocessRule;
use Exception;
use Psr\SimpleCache\CacheInterface;
use Throwable;

class FileParser
{
    public function __construct(protected CacheInterface $cache)
    {
    }

    /**
     * 解析文件内容.
     *
     * @param string $fileUrl 文件URL地址
     * @param bool $textPreprocess 是否进行文本预处理
     * @return string 解析后的文件内容
     * @throws Exception 当文件解析失败时
     */
    public function parse(string $fileUrl, bool $textPreprocess = false): string
    {
        // 使用md5作为缓存key
        $cacheKey = 'file_parser:parse_' . md5($fileUrl) . '_' . ($textPreprocess ? 1 : 0);
        // 检查缓存,如果存在则返回缓存内容
        if ($this->cache->has($cacheKey)) {
            return $this->cache->get($cacheKey, '');
        }
        try {
            // / 检测文件安全性
            $safeUrl = SSRFUtil::getSafeUrl($fileUrl, replaceIp: false);
            $tempFile = tempnam(sys_get_temp_dir(), 'downloaded_');

            $this->downloadFile($safeUrl, $tempFile, 50 * 1024 * 1024);

            $extension = FileType::getType($fileUrl);

            $interface = match ($extension) {
                // 更多的文件类型支持
                'png', 'jpeg', 'jpg' => OcrFileParserDriverInterface::class,
                'pdf' => PdfFileParserDriverInterface::class,
                'xlsx', 'xls', 'xlsm' => ExcelFileParserDriverInterface::class,
                'txt', 'json', 'csv', 'md', 'mdx',
                'py', 'java', 'php', 'js', 'html', 'htm', 'css', 'xml', 'yaml', 'yml', 'sql' => TextFileParserDriverInterface::class,
                'docx', 'doc' => WordFileParserDriverInterface::class,
                default => ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, 'flow.node.loader.unsupported_file_type', ['file_extension' => $extension]),
            };

            if (! container()->has($interface)) {
                ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, 'flow.node.loader.unsupported_file_type', ['file_extension' => $extension]);
            }

            /** @var FileParserDriverInterface $driver */
            $driver = di($interface);
            $res = $driver->parse($tempFile, $fileUrl, $extension);
            // 如果是csv、xlsx、xls文件，需要进行额外处理
            if ($textPreprocess && in_array($extension, ['csv', 'xlsx', 'xls'])) {
                $res = TextPreprocessUtil::preprocess([TextPreprocessRule::FORMAT_EXCEL], $res);
            }

            // 设置缓存
            $this->cache->set($cacheKey, $res, 600);
            return $res;
        } catch (Throwable $throwable) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, "[{$fileUrl}] fail to parse: {$throwable->getMessage()}");
        } finally {
            if (isset($tempFile) && file_exists($tempFile)) {
                unlink($tempFile); // 确保临时文件被删除
            }
        }
    }

    /**
     * 下载文件到临时位置.
     *
     * @param string $url 文件URL地址
     * @param string $tempFile 临时文件路径
     * @param int $maxSize 文件大小限制（字节），0表示不限制
     * @throws Exception 当下载失败或文件超限时
     */
    private static function downloadFile(string $url, string $tempFile, int $maxSize = 0): void
    {
        // 如果是本地文件路径，直接返回
        if (file_exists($url)) {
            return;
        }

        // 如果url是本地文件协议，转换为实际路径
        if (str_starts_with($url, 'file://')) {
            $localPath = substr($url, 7);
            if (file_exists($localPath)) {
                return;
            }
        }

        // 尝试预先检查文件大小
        $sizeKnown = self::checkUrlFileSize($url, $maxSize);

        $context = stream_context_create([
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
            ],
        ]);
        $fileStream = fopen($url, 'r', false, $context);
        $localFile = fopen($tempFile, 'w');

        if (! $fileStream || ! $localFile) {
            ExceptionBuilder::throw(FlowErrorCode::Error, message: '无法打开文件流');
        }

        // 如果文件大小未知，需要在下载过程中控制大小
        if (! $sizeKnown && $maxSize > 0) {
            self::downloadWithSizeControl($fileStream, $localFile, $maxSize);
        } else {
            // 文件大小已知或无需限制，直接复制
            stream_copy_to_stream($fileStream, $localFile);
        }

        fclose($fileStream);
        fclose($localFile);
    }

    /**
     * 流式下载并控制文件大小.
     *
     * @param resource $fileStream 远程文件流资源
     * @param resource $localFile 本地文件流资源
     * @param int $maxSize 文件大小限制（字节）
     * @throws Exception 当文件大小超限或写入失败时
     */
    private static function downloadWithSizeControl($fileStream, $localFile, int $maxSize): void
    {
        $downloadedBytes = 0;
        $bufferSize = 8192; // 8KB buffer

        while (! feof($fileStream)) {
            $buffer = fread($fileStream, $bufferSize);
            if ($buffer === false) {
                break;
            }

            $bufferLength = strlen($buffer);
            $downloadedBytes += $bufferLength;

            // Check if size limit exceeded
            if ($downloadedBytes > $maxSize) {
                ExceptionBuilder::throw(FlowErrorCode::Error, message: '文件大小超过限制');
            }

            // Write buffer to local file
            if (fwrite($localFile, $buffer) === false) {
                ExceptionBuilder::throw(FlowErrorCode::Error, message: '写入临时文件失败');
            }
        }
    }

    /**
     * 检查文件大小是否超限.
     *
     * @param string $fileUrl 文件URL地址
     * @param int $maxSize 文件大小限制（字节），0表示不限制
     * @return bool true表示已检查大小且在限制内，false表示是chunked传输需要流式下载
     * @throws Exception 当文件大小超过限制或文件大小未知且非chunked传输时
     */
    private static function checkUrlFileSize(string $fileUrl, int $maxSize = 0): bool
    {
        if ($maxSize <= 0) {
            return true;
        }
        // 下载之前，检测文件大小
        $headers = get_headers($fileUrl, true);
        if (isset($headers['Content-Length'])) {
            $fileSize = (int) $headers['Content-Length'];
            if ($fileSize > $maxSize) {
                ExceptionBuilder::throw(FlowErrorCode::Error, message: '文件大小超过限制');
            }
            return true;
        }

        // 没有Content-Length，检查是否为chunked传输
        $transferEncoding = $headers['Transfer-Encoding'] ?? '';
        if (is_array($transferEncoding)) {
            $transferEncoding = end($transferEncoding);
        }

        if (strtolower(trim($transferEncoding)) === 'chunked') {
            // chunked传输，允许流式下载
            return false;
        }

        // 既没有Content-Length，也不是chunked传输，拒绝下载
        ExceptionBuilder::throw(FlowErrorCode::Error, message: '文件大小未知，禁止下载');
    }
}

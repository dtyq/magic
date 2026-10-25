<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Processor;

use App\Application\ModelGateway\Struct\ImageProcessContext;
use App\Infrastructure\ExternalAPI\ImageRemoveBackground\ImageRemoveBackgroundResult;
use App\Infrastructure\Util\File\ImageFileInspector;
use App\Infrastructure\Util\File\TemporaryFileManager;
use Dtyq\CloudFile\Kernel\Struct\DownloadedRemoteFile;
use Dtyq\CloudFile\Kernel\Utils\SafeRemoteFileDownloader;
use InvalidArgumentException;
use Throwable;

/**
 * 把去背景 driver 的专属结果统一转成平台内部可继续处理的图片。
 * 该类是“外部协议”进入“通用图片处理管线”的桥接点，并统一持有图片链路的下载入口。
 */
final class ImageAssetMaterializer
{
    public function __construct(
        private readonly ImageFileInspector $imageFileInspector,
        private readonly SafeRemoteFileDownloader $downloader,
    ) {
    }

    /**
     * 将 driver 返回的本地文件或远程 URL 物化为可进入处理管线的上下文。
     * 远程 URL 会在这里被安全下载并登记到临时文件管理器中。
     */
    public function materialize(
        ImageRemoveBackgroundResult $result,
        TemporaryFileManager $temporaryFileManager,
    ): ImageProcessContext {
        if ($result->isLocalFile()) {
            $temporaryFileManager->add($result->getValue());

            return new ImageProcessContext(
                localFilePath: $result->getValue(),
                mimeType: $result->getMimeType(),
                provider: $result->getProvider(),
            );
        }

        $downloadedFile = $this->downloadRemoteImage($result->getValue());
        $temporaryFileManager->add($downloadedFile->getRealPath());

        return new ImageProcessContext(
            localFilePath: $downloadedFile->getRealPath(),
            mimeType: $downloadedFile->getMimeType(),
            provider: $result->getProvider(),
        );
    }

    /**
     * 安全下载远程图片到本地临时文件，并确认它确实是图片。
     * driver 结果物化与用户输入图下载共用这一入口，保证防护策略与错误语义一致。
     */
    public function downloadRemoteImage(string $imageUrl): DownloadedRemoteFile
    {
        try {
            $downloadedFile = $this->downloader->download($imageUrl);
        } catch (Throwable $throwable) {
            // 下载器抛的是第三方异常，这里统一转换成图片链路的业务异常，便于上层给出用户可读报错。
            throw new InvalidArgumentException('image_generate.image_download_failed', previous: $throwable);
        }

        try {
            $this->imageFileInspector->assertImageFile($downloadedFile->getRealPath());
        } catch (Throwable $throwable) {
            @unlink($downloadedFile->getRealPath());
            throw $throwable;
        }

        return $downloadedFile;
    }
}

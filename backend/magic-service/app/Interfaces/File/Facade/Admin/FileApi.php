<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\File\Facade\Admin;

use App\Application\File\Service\FileAppService;
use App\Domain\File\Constant\DefaultFileBusinessType;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;
use Swow\Psr7\Message\UploadedFile;

#[ApiResponse(version: 'low_code')]
class FileApi extends AbstractAdminApi
{
    #[Inject]
    protected FileAppService $fileAppService;

    public function getDefaultIcons()
    {
        return [
            'icons' => $this->fileAppService->getDefaultIcons(),
        ];
    }

    public function getUploadTemporaryCredential()
    {
        $sts = (bool) $this->request->input('sts', false);
        return $this->fileAppService->getSimpleUploadTemporaryCredential(
            $this->getAuthorization(),
            $this->request->input('storage'),
            $this->request->input('content_type'),
            $sts
        );
    }

    public function fileUpload()
    {
        /** @var UploadedFile $file */
        $file = $this->request->file('file');
        if (! $file instanceof UploadedFile) {
            return [];
        }
        $key = $this->request->input('key', '');
        $credential = $this->request->input('credential', '');
        return $this->fileAppService->fileUpload(
            $file,
            $key,
            $credential,
        );
    }

    public function publicFileDownload(RequestInterface $request): array
    {
        $fileKey = $request->input('file_key');
        $fileLink = $this->fileAppService->publicFileDownload($fileKey);
        return $fileLink ? $fileLink->toArray() : [];
    }

    public function getFileByBusinessType(RequestInterface $request)
    {
        $businessType = $request->input('business_type');
        /**
         * @var MagicUserAuthorization $authenticatable
         */
        $authenticatable = $this->getAuthorization();
        return $this->fileAppService->getFileByBusinessType(DefaultFileBusinessType::from($businessType), $authenticatable->getOrganizationCode());
    }

    public function uploadBusinessType(RequestInterface $request)
    {
        /**
         * @var MagicUserAuthorization $authenticatable
         */
        $authenticatable = $this->getAuthorization();
        $fileKey = $request->input('file_key');
        $businessType = $request->input('business_type');
        return $this->fileAppService->uploadBusinessType($authenticatable, $fileKey, $businessType);
    }

    public function deleteBusinessFile(RequestInterface $request)
    {
        /**
         * @var MagicUserAuthorization $authenticatable
         */
        $authenticatable = $this->getAuthorization();
        $fileKey = $request->input('file_key');
        $businessType = $request->input('business_type');
        return $this->fileAppService->deleteBusinessFile($authenticatable, $fileKey, $businessType);
    }
}

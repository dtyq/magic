<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Utils\SimpleUpload;

use Dtyq\CloudFile\Kernel\Exceptions\CloudFileException;
use Dtyq\CloudFile\Kernel\Struct\AppendUploadFile;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Dtyq\CloudFile\Kernel\Utils\CurlHelper;
use Dtyq\CloudFile\Kernel\Utils\SimpleUpload;
use Throwable;

class ObsSimpleUpload extends SimpleUpload
{
    /**
     * 上传到华为云.
     */
    public function uploadObject(array $credential, UploadFile $uploadFile): void
    {
        if (isset($credential['temporary_credential'])) {
            $credential = $credential['temporary_credential'];
        }
        if (! isset($credential['dir'])
            || ! isset($credential['policy'])
            || ! isset($credential['host'])
            || ! isset($credential['AccessKeyId'])
            || ! isset($credential['signature'])
        ) {
            throw new CloudFileException('Obs upload credential is invalid');
        }

        $key = $credential['dir'] . $uploadFile->getKeyPath();
        $body = [
            'key' => $key,
            'policy' => $credential['policy'],
            'AccessKeyId' => $credential['AccessKeyId'],
            'signature' => $credential['signature'],
            'file' => curl_file_create($uploadFile->getRealPath(), $uploadFile->getMimeType(), $uploadFile->getName()),
        ];
        if (! empty($credential['content_type'])) {
            $body['content-Type'] = $credential['content_type'];
        }

        try {
            CurlHelper::sendRequest($credential['host'], $body, [], 204);
        } catch (Throwable $exception) {
            $errorMsg = $exception->getMessage();
            throw $exception;
        } finally {
            if (isset($errorMsg)) {
                $this->sdkContainer->getLogger()->warning('simple_upload_fail', ['key' => $key, 'host' => $credential['host'], 'error_msg' => $errorMsg]);
            } else {
                $this->sdkContainer->getLogger()->info('simple_upload_success', ['key' => $key, 'host' => $credential['host']]);
            }
        }
        $uploadFile->setKey($key);
    }

    public function appendUploadObject(array $credential, AppendUploadFile $appendUploadFile): void
    {
        throw new CloudFileException('Tos does not support append upload');
    }

    /**
     * List objects by credential (not implemented yet).
     */
    public function listObjectsByCredential(array $credential, string $prefix = '', array $options = []): array
    {
        throw new CloudFileException('listObjectsByCredential not implemented for ObsSimpleUpload');
    }

    /**
     * Delete object by credential (not implemented yet).
     */
    public function deleteObjectByCredential(array $credential, string $objectKey, array $options = []): void
    {
        throw new CloudFileException('deleteObjectByCredential not implemented for ObsSimpleUpload');
    }

    /**
     * Copy object by credential (not implemented yet).
     */
    public function copyObjectByCredential(array $credential, string $sourceKey, string $destinationKey, array $options = []): void
    {
        throw new CloudFileException('copyObjectByCredential not implemented for ObsSimpleUpload');
    }

    /**
     * Get object metadata by credential (not implemented yet).
     */
    public function getHeadObjectByCredential(array $credential, string $objectKey, array $options = []): array
    {
        throw new CloudFileException('getHeadObjectByCredential not implemented for ObsSimpleUpload');
    }

    /**
     * Create object by credential (not implemented yet).
     */
    public function createObjectByCredential(array $credential, string $objectKey, array $options = []): void
    {
        throw new CloudFileException('createObjectByCredential not implemented for ObsSimpleUpload');
    }

    /**
     * Generate pre-signed URL by credential (not implemented yet).
     */
    public function getPreSignedUrlByCredential(array $credential, string $objectKey, array $options = []): string
    {
        throw new CloudFileException('getPreSignedUrlByCredential not implemented for ObsSimpleUpload');
    }

    /**
     * Delete multiple objects by credential (not implemented yet).
     */
    public function deleteObjectsByCredential(array $credential, array $objectKeys, array $options = []): array
    {
        throw new CloudFileException('deleteObjectsByCredential not implemented for ObsSimpleUpload');
    }

    /**
     * Set object metadata by credential (not implemented yet).
     */
    public function setHeadObjectByCredential(array $credential, string $objectKey, array $metadata, array $options = []): void
    {
        throw new CloudFileException('setHeadObjectByCredential not implemented for ObsSimpleUpload');
    }
}

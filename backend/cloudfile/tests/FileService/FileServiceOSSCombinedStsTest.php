<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Tests\FileService;

use Dtyq\CloudFile\Kernel\Struct\CredentialPolicy;
use Dtyq\CloudFile\Kernel\Utils\StsPolicyBuilder;
use Dtyq\CloudFile\Tests\CloudFileBaseTest;
use OSS\Credentials\StaticCredentialsProvider;
use OSS\OssClient;
use Throwable;

/**
 * FileService OSS 组合 STS 真实链路测试。
 *
 * @internal
 * @coversNothing
 */
class FileServiceOSSCombinedStsTest extends CloudFileBaseTest
{
    /**
     * 验证 file-service 返回的一份组合 STS 凭证可以完成上传、获取、列举和删除。
     */
    public function testCombinedStsCredentialSupportsPutHeadListAndDelete(): void
    {
        $filesystem = $this->getFilesystem();
        $options = array_merge($filesystem->getOptions(), ['cache' => false]);
        $credentialPolicy = new CredentialPolicy([
            'sts' => true,
            'role_session_name' => 'cloudfile-file-service-oss-combined-sts-test',
            'sts_type' => 'upload_objects|list_objects|del_objects',
        ]);

        $credential = $filesystem->getUploadTemporaryCredential($credentialPolicy, $options);
        $temporaryCredential = $credential['temporary_credential'];
        $policy = (new StsPolicyBuilder())->buildOss(
            $temporaryCredential['bucket'],
            $temporaryCredential['dir'],
            $credentialPolicy->getStsTypes()
        );
        $actions = array_merge(...array_map(
            static fn (array $statement): array => $statement['Action'],
            $policy['Statement']
        ));

        self::assertContains('oss:PutObject', $actions);
        self::assertContains('oss:ListObjects', $actions);
        self::assertContains('oss:DeleteObject', $actions);

        $host = parse_url($temporaryCredential['host'], PHP_URL_HOST);
        $endpointHost = preg_replace(
            '/^' . preg_quote($temporaryCredential['bucket'], '/') . '\./',
            '',
            (string) $host
        );
        $endpoint = (parse_url($temporaryCredential['host'], PHP_URL_SCHEME) ?: 'https') . '://' . $endpointHost;
        $client = new OssClient([
            'provider' => new StaticCredentialsProvider(
                $temporaryCredential['access_key_id'],
                $temporaryCredential['access_key_secret'],
                $temporaryCredential['sts_token']
            ),
            'endpoint' => $endpoint,
            'signatureVersion' => OssClient::OSS_SIGNATURE_VERSION_V4,
            'region' => preg_replace('/^oss-/', '', $temporaryCredential['region']),
        ]);
        $testKey = ($temporaryCredential['dir'] ?? '') . 'file-service-combined-sts-' . uniqid('', true) . '/upload-test.txt';
        $content = 'file-service OSS combined STS upload test';
        $deleted = false;

        try {
            $client->putObject(
                $temporaryCredential['bucket'],
                $testKey,
                $content,
                [OssClient::OSS_CONTENT_TYPE => 'text/plain']
            );

            $metadata = $client->getObjectMeta($temporaryCredential['bucket'], $testKey);
            self::assertSame((string) strlen($content), (string) ($metadata['content-length'] ?? ''));

            $listResult = $client->listObjects($temporaryCredential['bucket'], [
                OssClient::OSS_PREFIX => $testKey,
                OssClient::OSS_MAX_KEYS => 10,
            ]);
            $objectKeys = array_map(static fn ($object): string => $object->getKey(), $listResult->getObjectList());
            self::assertContains($testKey, $objectKeys);

            $client->deleteObject($temporaryCredential['bucket'], $testKey);
            $deleted = true;

            try {
                $client->getObjectMeta($temporaryCredential['bucket'], $testKey);
                self::fail('删除后的 file-service OSS 对象仍可获取');
            } catch (Throwable) {
                self::assertTrue(true);
            }
        } finally {
            if (! $deleted) {
                try {
                    $client->deleteObject($temporaryCredential['bucket'], $testKey);
                } catch (Throwable) {
                    // 主断言失败时不覆盖原始异常。
                }
            }
        }
    }

    /**
     * 获取 file-service OSS 测试存储。
     */
    protected function getStorageName(): string
    {
        return 'file_service_test';
    }
}

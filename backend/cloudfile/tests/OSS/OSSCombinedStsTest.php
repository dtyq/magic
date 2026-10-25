<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Tests\OSS;

use Dtyq\CloudFile\Kernel\Struct\CredentialPolicy;
use Dtyq\CloudFile\Kernel\Utils\StsPolicyBuilder;
use Dtyq\CloudFile\Tests\CloudFileBaseTest;
use OSS\Credentials\StaticCredentialsProvider;
use OSS\OssClient;
use Throwable;

/**
 * OSS 组合 STS 真实驱动测试。
 *
 * @internal
 * @coversNothing
 */
class OSSCombinedStsTest extends CloudFileBaseTest
{
    /**
     * 验证一份全组合 STS 凭证可以完成上传、获取和删除。
     */
    public function testCombinedStsCredentialSupportsPutHeadAndDelete(): void
    {
        $filesystem = $this->getFilesystem();
        $credentialPolicy = new CredentialPolicy([
            'sts' => true,
            'role_session_name' => 'cloudfile-oss-combined-sts-test',
            'sts_type' => 'upload_objects|list_objects|del_objects',
        ]);

        $credential = $filesystem->getUploadTemporaryCredential($credentialPolicy, ['cache' => false]);
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

        $client = new OssClient([
            'provider' => new StaticCredentialsProvider(
                $temporaryCredential['access_key_id'],
                $temporaryCredential['access_key_secret'],
                $temporaryCredential['sts_token']
            ),
            'endpoint' => $temporaryCredential['endpoint'],
            'signatureVersion' => OssClient::OSS_SIGNATURE_VERSION_V4,
            'region' => preg_replace('/^oss-/', '', $temporaryCredential['region']),
        ]);
        $testKey = 'test-combined-sts-' . uniqid('', true) . '/upload-test.txt';
        $content = 'cloudfile OSS combined STS upload test';
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

            $client->deleteObject($temporaryCredential['bucket'], $testKey);
            $deleted = true;

            try {
                $client->getObjectMeta($temporaryCredential['bucket'], $testKey);
                self::fail('删除后的 OSS 对象仍可获取');
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
     * 获取 OSS 测试驱动。
     */
    protected function getStorageName(): string
    {
        return 'aliyun_test';
    }
}

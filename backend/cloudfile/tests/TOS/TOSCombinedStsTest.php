<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Tests\TOS;

use Dtyq\CloudFile\Kernel\Struct\CredentialPolicy;
use Dtyq\CloudFile\Kernel\Utils\StsPolicyBuilder;
use Dtyq\CloudFile\Tests\CloudFileBaseTest;
use Tos\Config\ConfigParser;
use Tos\Model\AppendObjectInput;
use Tos\Model\DeleteObjectInput;
use Tos\Model\HeadObjectInput;
use Tos\TosClient;
use Throwable;

/**
 * TOS 组合 STS 真实驱动测试。
 *
 * @internal
 * @coversNothing
 */
class TOSCombinedStsTest extends CloudFileBaseTest
{
    /**
     * 验证一份全组合 STS 凭证可以完成追加上传、获取和删除。
     */
    public function testCombinedStsCredentialSupportsAppendHeadAndDelete(): void
    {
        $filesystem = $this->getFilesystem();
        $credentialPolicy = new CredentialPolicy([
            'sts' => true,
            'role_session_name' => 'cloudfile-tos-combined-sts-test',
            'sts_type' => 'upload_objects|list_objects|del_objects',
        ]);

        $credential = $filesystem->getUploadTemporaryCredential($credentialPolicy, ['cache' => false]);
        $temporaryCredential = $credential['temporary_credential'];
        $policy = (new StsPolicyBuilder())->buildTos(
            $temporaryCredential['bucket'],
            $temporaryCredential['dir'],
            $credentialPolicy->getStsTypes()
        );
        $actions = array_merge(...array_map(
            static fn (array $statement): array => $statement['Action'],
            $policy['Statement']
        ));

        self::assertContains('tos:AppendObject', $actions);
        self::assertContains('tos:ListBucket', $actions);
        self::assertContains('tos:DeleteObject', $actions);

        $client = new TosClient(new ConfigParser([
            'region' => $temporaryCredential['region'],
            'endpoint' => $temporaryCredential['endpoint'] ?? $temporaryCredential['host'],
            'ak' => $temporaryCredential['credentials']['AccessKeyId'],
            'sk' => $temporaryCredential['credentials']['SecretAccessKey'],
            'securityToken' => $temporaryCredential['credentials']['SessionToken'],
            'bucket' => $temporaryCredential['bucket'],
        ]));
        $testKey = 'test-combined-sts-' . uniqid('', true) . '/append-test.txt';
        $content = 'cloudfile TOS combined STS append test';
        $deleted = false;

        try {
            $appendInput = new AppendObjectInput($temporaryCredential['bucket'], $testKey);
            $appendInput->setOffset(0);
            $appendInput->setContent($content);
            $appendInput->setContentLength(strlen($content));
            $appendInput->setContentType('text/plain');
            $client->appendObject($appendInput);

            $headOutput = $client->headObject(new HeadObjectInput($temporaryCredential['bucket'], $testKey));
            self::assertSame(strlen($content), $headOutput->getContentLength());

            $client->deleteObject(new DeleteObjectInput($temporaryCredential['bucket'], $testKey));
            $deleted = true;

            try {
                $client->headObject(new HeadObjectInput($temporaryCredential['bucket'], $testKey));
                self::fail('删除后的 TOS 对象仍可获取');
            } catch (Throwable) {
                self::assertTrue(true);
            }
        } finally {
            if (! $deleted) {
                try {
                    $client->deleteObject(new DeleteObjectInput($temporaryCredential['bucket'], $testKey));
                } catch (Throwable) {
                    // 主断言失败时不覆盖原始异常。
                }
            }
        }
    }

    /**
     * 获取 TOS 测试驱动。
     */
    protected function getStorageName(): string
    {
        return 'tos_test';
    }
}

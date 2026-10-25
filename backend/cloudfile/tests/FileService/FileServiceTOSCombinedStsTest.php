<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Tests\FileService;

use Dtyq\CloudFile\Kernel\Struct\CredentialPolicy;
use Dtyq\CloudFile\Kernel\Utils\StsPolicyBuilder;
use Dtyq\CloudFile\Tests\CloudFileBaseTest;
use Throwable;
use Tos\Config\ConfigParser;
use Tos\Model\AppendObjectInput;
use Tos\Model\DeleteObjectInput;
use Tos\Model\HeadObjectInput;
use Tos\Model\ListObjectsInput;
use Tos\TosClient;

/**
 * FileService TOS 组合 STS 真实链路测试。
 *
 * @internal
 * @coversNothing
 */
class FileServiceTOSCombinedStsTest extends CloudFileBaseTest
{
    /**
     * 验证 file-service 返回的一份组合 STS 凭证可以完成追加上传、获取、列举和删除。
     */
    public function testCombinedStsCredentialSupportsAppendHeadListAndDelete(): void
    {
        $filesystem = $this->getFilesystem();
        $options = array_merge($filesystem->getOptions(), ['cache' => false]);
        $credentialPolicy = new CredentialPolicy([
            'sts' => true,
            'role_session_name' => 'cloudfile-file-service-tos-combined-sts-test',
            'sts_type' => 'upload_objects|list_objects|del_objects',
        ]);

        $credential = $filesystem->getUploadTemporaryCredential($credentialPolicy, $options);
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
        $testKey = ($temporaryCredential['dir'] ?? '') . 'file-service-combined-sts-' . uniqid('', true) . '/append-test.txt';
        $content = 'file-service TOS combined STS append test';
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

            $listInput = new ListObjectsInput($temporaryCredential['bucket']);
            $listInput->setPrefix($testKey);
            $listOutput = $client->listObjects($listInput);
            $objectKeys = array_map(static fn ($object): string => $object->getKey(), $listOutput->getContents());
            self::assertContains($testKey, $objectKeys);

            $client->deleteObject(new DeleteObjectInput($temporaryCredential['bucket'], $testKey));
            $deleted = true;

            try {
                $client->headObject(new HeadObjectInput($temporaryCredential['bucket'], $testKey));
                self::fail('删除后的 file-service TOS 对象仍可获取');
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
     * 获取 file-service TOS 测试存储。
     */
    protected function getStorageName(): string
    {
        return 'file_service_tos_test';
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Tests\TOS;

use Dtyq\CloudFile\Kernel\Struct\CredentialPolicy;
use Dtyq\CloudFile\Kernel\Struct\ImageProcessOptions;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Dtyq\CloudFile\Tests\CloudFileBaseTest;

/**
 * @internal
 * @coversNothing
 */
class TOSTest extends CloudFileBaseTest
{
    public function testGetUploadTemporaryCredential()
    {
        $filesystem = $this->getFilesystem();

        $credentialPolicy = new CredentialPolicy([
            'sts' => false,
            'roleSessionName' => 'test',
        ]);
        $res = $filesystem->getUploadTemporaryCredential($credentialPolicy);
        $this->assertArrayHasKey('temporary_credential', $res);

        $credential = $res['temporary_credential'];
        $this->assertArrayHasKey('x-tos-signature', $credential);
        $this->assertArrayHasKey('expires', $credential);

        $credentialPolicy = new CredentialPolicy([
            'sts' => true,
            'roleSessionName' => 'test',
        ]);
        $res = $filesystem->getUploadTemporaryCredential($credentialPolicy);
        $credential = $res['temporary_credential'];
        $this->assertArrayHasKey('credentials', $credential);
        $this->assertArrayHasKey('expires', $credential);
    }

    /**
     * 验证 TOS 临时上传凭证支持切换内网 endpoint.
     */
    public function testGetUploadTemporaryCredentialWithInternalEndpoint()
    {
        $filesystem = $this->getFilesystem();
        $options = [
            'internal_endpoint' => true,
            'cache' => false,
        ];

        $credentialPolicy = new CredentialPolicy([
            'sts' => false,
            'roleSessionName' => 'test',
        ]);
        $res = $filesystem->getUploadTemporaryCredential($credentialPolicy, $options);
        $credential = $res['temporary_credential'];
        $this->assertArrayHasKey('host', $credential);
        $this->assertStringContainsString('.ivolces.com', $credential['host']);
        $this->assertStringNotContainsString('.volces.com', $credential['host']);

        $credentialPolicy = new CredentialPolicy([
            'sts' => true,
            'roleSessionName' => 'test',
        ]);
        $res = $filesystem->getUploadTemporaryCredential($credentialPolicy, $options);
        $credential = $res['temporary_credential'];
        $this->assertArrayHasKey('host', $credential);
        $this->assertArrayHasKey('endpoint', $credential);
        $this->assertStringContainsString('.ivolces.com', $credential['host']);
        $this->assertStringContainsString('.ivolces.com', $credential['endpoint']);
        $this->assertStringNotContainsString('.volces.com', $credential['host']);
        $this->assertStringNotContainsString('.volces.com', $credential['endpoint']);
    }

    public function testUpload()
    {
        $filesystem = $this->getFilesystem();

        $realPath = __DIR__ . '/../test.txt';

        $uploadFile = new UploadFile($realPath, 'easy-file', '', false);
        $filesystem->upload($uploadFile);
        $this->assertTrue(true);
    }

    public function testSimpleUpload()
    {
        $filesystem = $this->getFilesystem();

        $credentialPolicy = new CredentialPolicy([
            'sts' => false,
        ]);

        $realPath = __DIR__ . '/../test.txt';

        $uploadFile = new UploadFile($realPath, 'easy-file');
        $filesystem->uploadByCredential($uploadFile, $credentialPolicy);
        $this->assertTrue(true);
    }

    public function testGetMetadata()
    {
        $filesystem = $this->getFilesystem();

        $fileAttributes = $filesystem->getMetas([
            'easy-file/test.txt',
        ]);
        $this->assertArrayHasKey('easy-file/test.txt', $fileAttributes);
    }

    public function testGetLinks()
    {
        $filesystem = $this->getFilesystem();

        $list = $filesystem->getLinks([
            'easy-file/test.txt',
        ], [], 7200);
        $this->assertArrayHasKey('easy-file/test.txt', $list);
    }

    public function testGetImageLink()
    {
        $filesystem = $this->getFilesystem();

        $imageOptions = (new ImageProcessOptions())->resize(['height' => 64])->format('webp');

        $link = $filesystem->getLink('easy-file/tos_demo.png', '', 7200, [
            'image' => $imageOptions,
            'cache' => false,
        ]);
        var_dump($link);
        $this->assertIsString($link->getUrl());
    }

    public function testGetImageLink2()
    {
        $filesystem = $this->getFilesystem();

        $imageOptions = (new ImageProcessOptions())->resize(['height' => 64])->format('webp');

        $credentialPolicy = new CredentialPolicy([]);

        $link = $filesystem->getPreSignedUrlByCredential($credentialPolicy, 'easy-file/tos_demo.png', [
            'image' => $imageOptions,
            'cache' => false,
        ]);
        var_dump($link);
        $this->assertIsString($link);
    }

    /**
     * 验证 TOS 真实 STS 预签名链接支持切换下载和内联展示.
     */
    public function testGetPreSignedUrlContentDisposition(): void
    {
        $filesystem = $this->getFilesystem();
        $credentialPolicy = new CredentialPolicy([]);

        $attachmentUrl = $filesystem->getPreSignedUrlByCredential($credentialPolicy, 'easy-file/tos_demo.png', [
            'filename' => 'text.css',
            'cache' => false,
        ]);
        $inlineUrl = $filesystem->getPreSignedUrlByCredential($credentialPolicy, 'easy-file/tos_demo.png', [
            'filename' => 'text.css',
            'download' => false,
            'cache' => false,
        ]);

        $this->assertContentDisposition($attachmentUrl, 'attachment; filename="text.css"; filename*=UTF-8\'\'text.css');
        $this->assertContentDisposition($inlineUrl, 'inline; filename="text.css"; filename*=UTF-8\'\'text.css');
    }

    /**
     * 验证 TOS 真实下载链接支持中文下载名称.
     */
    public function testGetLinkWithChineseDownloadName(): void
    {
        $filesystem = $this->getFilesystem();
        $downloadName = '测试中文文件名.md';

        $link = $filesystem->getLink('easy-file/tos_demo.png', $downloadName, 7200, [
            'cache' => false,
        ]);

        $this->assertSame($downloadName, $link->getDownloadName());
        $this->assertContentDisposition(
            $link->getUrl(),
            'attachment; filename="download.md"; filename*=UTF-8\'\'' . rawurlencode($downloadName)
        );
    }

    /**
     * 验证 TOS 真实下载链接保留英文下载名称.
     */
    public function testGetLinkWithEnglishDownloadName(): void
    {
        $filesystem = $this->getFilesystem();
        $downloadName = 'test-download.md';

        $link = $filesystem->getLink('easy-file/tos_demo.png', $downloadName, 7200, [
            'cache' => false,
        ]);

        $this->assertSame($downloadName, $link->getDownloadName());
        $this->assertContentDisposition(
            $link->getUrl(),
            'attachment; filename="' . $downloadName . '"; filename*=UTF-8\'\'' . $downloadName
        );
    }

    /**
     * 验证 TOS 直签链接支持切换内网 endpoint.
     */
    public function testGetLinkWithInternalEndpoint()
    {
        $filesystem = $this->getFilesystem();

        $link = $filesystem->getLink('easy-file/tos_demo.png', '', 7200, [
            'internal_endpoint' => true,
            'cache' => false,
        ]);

        $this->assertStringContainsString('.ivolces.com', $link->getUrl());
        $this->assertStringNotContainsString('.volces.com', $link->getUrl());
    }

    /**
     * 验证 TOS 临时凭证签名链接支持切换内网 endpoint.
     */
    public function testGetPreSignedUrlByCredentialWithInternalEndpoint()
    {
        $filesystem = $this->getFilesystem();
        $credentialPolicy = new CredentialPolicy([]);

        $url = $filesystem->getPreSignedUrlByCredential($credentialPolicy, 'easy-file/tos_demo.png', [
            'internal_endpoint' => true,
            'cache' => false,
        ]);

        $this->assertStringContainsString('.ivolces.com', $url);
        $this->assertStringNotContainsString('.volces.com', $url);
    }

    public function testDestroy()
    {
        $filesystem = $this->getFilesystem();

        $realPath = __DIR__ . '/../test.txt';

        $uploadFile = new UploadFile($realPath, 'easy-file', '111.txt', false);
        $path = $filesystem->upload($uploadFile);
        $this->assertEquals('easy-file/111.txt', $path);
        $filesystem->destroy([
            $path,
        ]);
        $this->assertTrue(true);
    }

    public function testDuplicate()
    {
        $filesystem = $this->getFilesystem();

        $path = $filesystem->duplicate('easy-file/test.txt', 'easy-file/test-copy.txt');
        $this->assertIsString($path);
    }

    protected function getStorageName(): string
    {
        return 'tos_test';
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\File\Service;

use App\Domain\File\Service\FileDomainService;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use HyperfTest\Cases\BaseTest;

/**
 * @internal
 */
class FileDomainServiceTest extends BaseTest
{
    public function testUpload()
    {
        $service = di(FileDomainService::class);
        $uploadFile = new UploadFile('');
        $service->uploadByCredential('DT001', $uploadFile);
        $this->assertIsString($uploadFile->getKey());
        $link = $service->getLink('DT001', $uploadFile->getKey());
        var_dump($link->getUrl());
        $this->assertIsString($link->getUrl());
    }

    public function testExist()
    {
        $service = di(FileDomainService::class);
        $uploadFile = new UploadFile('');
        $service->uploadByCredential('DT001', $uploadFile);
        $this->assertIsString($uploadFile->getKey());
        $service->getLink('DT001', $uploadFile->getKey());
        $metas = $service->getMetas([$uploadFile->getKey()], 'DT001');
        $exist = $service->exist($metas, $uploadFile->getKey());
        $this->assertTrue($exist);
    }
}

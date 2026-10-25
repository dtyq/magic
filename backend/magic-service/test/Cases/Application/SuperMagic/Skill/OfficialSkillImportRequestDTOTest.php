<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Skill;

use App\Interfaces\SuperMagic\Skill\DTO\Request\ImportOfficialSkillRequestDTO;
use FastRoute\Dispatcher;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\HttpServer\Router\Dispatched;
use Hyperf\Validation\ValidationException;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class OfficialSkillImportRequestDTOTest extends TestCase
{
    public function testImportRequiresExactlyOneImportSource(): void
    {
        $this->expectException(ValidationException::class);

        ImportOfficialSkillRequestDTO::fromRequest($this->createRequest([
            'name_i18n' => ['en_US' => 'Official skill'],
        ]));
    }

    public function testImportRejectsBothImportTokenAndFileKey(): void
    {
        $this->expectException(ValidationException::class);

        ImportOfficialSkillRequestDTO::fromRequest($this->createRequest([
            'import_token' => 'token',
            'file_key' => 'official/demo.zip',
            'name_i18n' => ['en_US' => 'Official skill'],
        ]));
    }

    public function testImportReadsFileKeySourceAndMarketFields(): void
    {
        $dto = ImportOfficialSkillRequestDTO::fromRequest($this->createRequest([
            'file_key' => 'official/demo.zip',
            'version' => '1.0.0',
            'name_i18n' => ['default' => 'Official skill'],
            'description_i18n' => ['default' => 'Description'],
            'source_i18n' => ['default' => 'Official'],
            'category_ids' => ['1', '2'],
            'publisher_type' => 'OFFICIAL',
            'publish_status' => 'OFFLINE',
            'is_hidden' => true,
            'is_featured' => false,
            'sort_order' => 10,
        ]));

        $this->assertSame('official/demo.zip', $dto->getFileKey());
        $this->assertSame('1.0.0', $dto->getVersion());
        $this->assertSame(['1', '2'], $dto->getCategoryIdList());
        $this->assertSame('OFFICIAL', $dto->getPublisherType());
        $this->assertTrue($dto->isHidden());
    }

    public function testImportRejectsUserPublisherType(): void
    {
        $this->expectException(ValidationException::class);

        ImportOfficialSkillRequestDTO::fromRequest($this->createRequest([
            'file_key' => 'official/demo.zip',
            'version' => '1.0.0',
            'name_i18n' => ['default' => 'Official skill'],
            'description_i18n' => ['default' => 'Description'],
            'publisher_type' => 'USER',
        ]));
    }

    public function testImportRejectsUnsupportedPublisherType(): void
    {
        $this->expectException(ValidationException::class);

        ImportOfficialSkillRequestDTO::fromRequest($this->createRequest([
            'file_key' => 'official/demo.zip',
            'version' => '1.0.0',
            'name_i18n' => ['default' => 'Official skill'],
            'description_i18n' => ['default' => 'Description'],
            'publisher_type' => 'PARTNER',
        ]));
    }

    public function testImportRejectsInvalidVersionFormat(): void
    {
        $this->expectException(ValidationException::class);

        ImportOfficialSkillRequestDTO::fromRequest($this->createRequest([
            'file_key' => 'official/demo.zip',
            'version' => 'adasd',
            'name_i18n' => ['default' => 'Official skill'],
            'description_i18n' => ['default' => 'Description'],
        ]));
    }

    public function testImportDefaultsToOfficialPublisher(): void
    {
        $dto = ImportOfficialSkillRequestDTO::fromRequest($this->createRequest([
            'file_key' => 'official/demo.zip',
            'version' => '1.0.0',
            'name_i18n' => ['default' => 'Official skill'],
            'description_i18n' => ['default' => 'Description'],
        ]));

        $this->assertSame('OFFICIAL', $dto->getPublisherType());
        $this->assertSame([], $dto->getCategoryIdList());
    }

    private function createRequest(array $payload): RequestInterface
    {
        $request = $this->createMock(RequestInterface::class);
        $request->expects($this->once())
            ->method('all')
            ->willReturn($payload);
        $request->expects($this->once())
            ->method('getAttribute')
            ->with(Dispatched::class)
            ->willReturn(new Dispatched([Dispatcher::NOT_FOUND]));

        return $request;
    }
}

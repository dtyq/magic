<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\KnowledgeBase\Rpc\Service;

use App\Application\KnowledgeBase\Port\ThirdPlatformDocumentProviderPort;
use App\Application\KnowledgeBase\Service\Strategy\DocumentFile\DocumentFileStrategy;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\ThirdPlatformDocumentFile;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Interfaces\KnowledgeBase\Rpc\Service\ThirdPlatformDocumentRpcService;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

/**
 * @internal
 */
class ThirdPlatformDocumentRpcServiceTest extends TestCase
{
    private const int FILE_TYPE_MULTI_TABLE = 1;

    private const int FILE_TYPE_WORD = 2;

    private const int FILE_TYPE_EXCEL = 3;

    private const int FILE_TYPE_CLOUD_DOCUMENT = 16;

    public function testResolveShouldRejectMissingPlatformTypeBeforePreProcess(): void
    {
        $documentFileStrategy = $this->createMock(DocumentFileStrategy::class);
        $documentFileStrategy->expects($this->never())->method('preProcessDocumentFile');

        $service = $this->newService($documentFileStrategy);
        $params = $this->baseResolveParams();
        unset($params['third_platform_type'], $params['document_file']['platform_type']);

        $result = $service->resolve($params);

        $this->assertSame(400, $result['code']);
        $this->assertSame('document_file.platform_type is required for third_platform preview', $result['message']);
    }

    public function testResolveShouldRejectMissingThirdFileIdBeforePreProcess(): void
    {
        $documentFileStrategy = $this->createMock(DocumentFileStrategy::class);
        $documentFileStrategy->expects($this->never())->method('preProcessDocumentFile');

        $service = $this->newService($documentFileStrategy);
        $params = $this->baseResolveParams();
        unset($params['third_file_id'], $params['document_file']['third_file_id']);

        $result = $service->resolve($params);

        $this->assertSame(400, $result['code']);
        $this->assertSame('document_file.third_file_id is required for third_platform preview', $result['message']);
    }

    public function testResolveShouldExposeUnavailableCodeWhenThirdPlatformFileCannotBePreProcessed(): void
    {
        $documentFileStrategy = $this->createMock(DocumentFileStrategy::class);
        $documentFileStrategy->expects($this->once())
            ->method('preProcessDocumentFile')
            ->willThrowException(new BusinessException('resolve third_platform document failed: missing or unsupported file identifiers'));

        $service = $this->newService($documentFileStrategy);
        $result = $service->resolve($this->baseResolveParams());

        $this->assertSame(40404, $result['code']);
        $this->assertSame('resolve third_platform document failed: missing or unsupported file identifiers', $result['message']);
    }

    public function testResolveCloudDocumentShouldReturnRawMarkdownAndMdExtension(): void
    {
        $documentFile = $this->makeThirdPlatformDocumentFile((string) self::FILE_TYPE_CLOUD_DOCUMENT, 'docx');
        $documentFileStrategy = $this->createMock(DocumentFileStrategy::class);
        $documentFileStrategy->expects($this->once())
            ->method('preProcessDocumentFile')
            ->with($this->isInstanceOf(KnowledgeBaseDataIsolation::class), $this->isInstanceOf(ThirdPlatformDocumentFile::class))
            ->willReturn($documentFile);
        $documentFileStrategy->expects($this->never())->method('parseContent');

        $thirdPlatformDocumentProvider = $this->createMock(ThirdPlatformDocumentProviderPort::class);
        $thirdPlatformDocumentProvider->expects($this->once())
            ->method('getFileMarkdown')
            ->willReturn('# Teamshare Markdown');
        $thirdPlatformDocumentProvider->expects($this->never())->method('getFileDownloadUrls');

        $service = $this->newService($documentFileStrategy, $thirdPlatformDocumentProvider);
        $result = $service->resolve($this->baseResolveParams());

        $this->assertSame(0, $result['code']);
        $this->assertSame('raw_content', $result['data']['source_kind']);
        $this->assertSame('# Teamshare Markdown', $result['data']['raw_content']);
        $this->assertSame('', $result['data']['download_url']);
        $this->assertSame([], $result['data']['download_urls']);
        $this->assertSame('md', $result['data']['document_file']['extension']);
        $this->assertSame('', $result['data']['content']);
    }

    public function testResolveMultiTableShouldReturnCsvRawContent(): void
    {
        $documentFile = $this->makeThirdPlatformDocumentFile((string) self::FILE_TYPE_MULTI_TABLE, 'xlsx');
        $documentFileStrategy = $this->createMock(DocumentFileStrategy::class);
        $documentFileStrategy->method('preProcessDocumentFile')->willReturn($documentFile);
        $documentFileStrategy->expects($this->never())->method('parseContent');

        $thirdPlatformDocumentProvider = $this->createMock(ThirdPlatformDocumentProviderPort::class);
        $thirdPlatformDocumentProvider->expects($this->once())
            ->method('getFileMarkdown')
            ->willReturn("## 表格\n| 城市 | 门店 |\n| --- | --- |\n| 上海 | 徐汇 |\n");
        $thirdPlatformDocumentProvider->expects($this->never())->method('getFileDownloadUrls');

        $service = $this->newService($documentFileStrategy, $thirdPlatformDocumentProvider);
        $result = $service->resolve($this->baseResolveParams());

        $this->assertSame(0, $result['code']);
        $this->assertSame('raw_content', $result['data']['source_kind']);
        $this->assertStringContainsString('城市: 上海,门店: 徐汇', $result['data']['raw_content']);
        $this->assertSame([], $result['data']['download_urls']);
        $this->assertSame('csv', $result['data']['document_file']['extension']);
    }

    public function testResolveBinaryFileShouldReturnDownloadUrlWithoutPhpParse(): void
    {
        $documentFile = $this->makeThirdPlatformDocumentFile((string) self::FILE_TYPE_WORD, 'docx');
        $documentFileStrategy = $this->createMock(DocumentFileStrategy::class);
        $documentFileStrategy->method('preProcessDocumentFile')->willReturn($documentFile);
        $documentFileStrategy->expects($this->never())->method('parseContent');

        $thirdPlatformDocumentProvider = $this->createMock(ThirdPlatformDocumentProviderPort::class);
        $thirdPlatformDocumentProvider->expects($this->never())->method('getFileMarkdown');
        $thirdPlatformDocumentProvider->expects($this->once())
            ->method('getFileDownloadUrls')
            ->willReturn(['https://download.example.com/demo.docx']);

        $service = $this->newService($documentFileStrategy, $thirdPlatformDocumentProvider);
        $result = $service->resolve($this->baseResolveParams());

        $this->assertSame(0, $result['code']);
        $this->assertSame('download_url', $result['data']['source_kind']);
        $this->assertSame('', $result['data']['raw_content']);
        $this->assertSame('https://download.example.com/demo.docx', $result['data']['download_url']);
        $this->assertSame(['https://download.example.com/demo.docx'], $result['data']['download_urls']);
        $this->assertSame('docx', $result['data']['document_file']['extension']);
        $this->assertSame('', $result['data']['content']);
    }

    public function testResolveExcelShouldReturnDownloadUrlsWithoutSelecting(): void
    {
        $documentFile = $this->makeThirdPlatformDocumentFile((string) self::FILE_TYPE_EXCEL, 'xlsx');
        $documentFileStrategy = $this->createMock(DocumentFileStrategy::class);
        $documentFileStrategy->method('preProcessDocumentFile')->willReturn($documentFile);
        $documentFileStrategy->expects($this->never())->method('parseContent');

        $thirdPlatformDocumentProvider = $this->createMock(ThirdPlatformDocumentProviderPort::class);
        $thirdPlatformDocumentProvider->expects($this->never())->method('getFileMarkdown');
        $thirdPlatformDocumentProvider->expects($this->once())
            ->method('getFileDownloadUrls')
            ->willReturn([
                'https://download.example.com/original.xlsx',
                'https://download.example.com/export.xlsx',
            ]);

        $service = $this->newService($documentFileStrategy, $thirdPlatformDocumentProvider);
        $result = $service->resolve($this->baseResolveParams());

        $this->assertSame(0, $result['code']);
        $this->assertSame('download_url', $result['data']['source_kind']);
        $this->assertSame('https://download.example.com/original.xlsx', $result['data']['download_url']);
        $this->assertSame([
            'https://download.example.com/original.xlsx',
            'https://download.example.com/export.xlsx',
        ], $result['data']['download_urls']);
        $this->assertSame('xlsx', $result['data']['document_file']['extension']);
    }

    public function testListTreeNodesShouldReturnTeamshareRawCascadeDataAsIs(): void
    {
        $rawChildren = [
            [
                'id' => 1001,
                'knowledge_base_id' => 9001,
                'parent_id' => 9001,
                'name' => '目录1',
                'file_type' => 0,
                'extension' => '',
                'path' => [
                    ['id' => 9001, 'name' => '知识库', 'type' => 9],
                    ['id' => 1001, 'name' => '目录1', 'type' => 0],
                ],
            ],
            [
                'id' => 1002,
                'knowledge_base_id' => 9001,
                'parent_id' => 1001,
                'name' => '财务.xlsx',
                'file_type' => 3,
                'extension' => 'xlsx',
                'path' => [
                    ['id' => 9001, 'name' => '知识库', 'type' => 9],
                    ['id' => 1001, 'name' => '目录1', 'type' => 0],
                    ['id' => 1002, 'name' => '财务.xlsx', 'type' => 3],
                ],
            ],
        ];

        $documentFileStrategy = $this->createMock(DocumentFileStrategy::class);
        $thirdPlatformDocumentProvider = $this->createMock(ThirdPlatformDocumentProviderPort::class);
        $thirdPlatformDocumentProvider->expects($this->once())
            ->method('listDirectChildren')
            ->willReturn($rawChildren);

        $service = $this->newService($documentFileStrategy, $thirdPlatformDocumentProvider);
        $result = $service->listTreeNodes([
            'data_isolation' => [
                'organization_code' => 'ORG1',
                'user_id' => 'U1',
            ],
            'parent_type' => 'folder',
            'parent_ref' => '1001',
        ]);

        $this->assertSame(0, $result['code']);
        $this->assertSame('success', $result['message']);
        $this->assertSame($rawChildren, $result['data']);
    }

    private function newService(
        DocumentFileStrategy $documentFileStrategy,
        ?ThirdPlatformDocumentProviderPort $thirdPlatformDocumentProvider = null,
        ?LoggerInterface $logger = null,
    ): ThirdPlatformDocumentRpcService {
        return new ThirdPlatformDocumentRpcService(
            $documentFileStrategy,
            $thirdPlatformDocumentProvider ?? $this->createMock(ThirdPlatformDocumentProviderPort::class),
            $logger ?? $this->createMock(LoggerInterface::class)
        );
    }

    private function makeThirdPlatformDocumentFile(string $thirdFileType, string $extension): ThirdPlatformDocumentFile
    {
        return new ThirdPlatformDocumentFile([
            'name' => 'demo.' . $extension,
            'platform_type' => 'teamshare',
            'third_file_id' => 'FILE-1',
            'third_file_type' => $thirdFileType,
            'third_file_extension_name' => $extension,
        ]);
    }

    private function baseResolveParams(): array
    {
        return [
            'data_isolation' => [
                'organization_code' => 'ORG1',
                'user_id' => 'U1',
            ],
            'third_platform_type' => 'teamshare',
            'third_file_id' => 'FILE-1',
            'document_file' => [
                'type' => 'third_platform',
                'name' => 'demo.docx',
                'platform_type' => 'teamshare',
                'third_file_id' => 'FILE-1',
                'extension' => 'docx',
            ],
        ];
    }
}

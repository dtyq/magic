<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\KnowledgeBase\Rpc\Service;

use App\Application\KnowledgeBase\Service\Strategy\DocumentFile\DocumentFileStrategy;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\ThirdPlatformDocumentFile;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Interfaces\KnowledgeBase\Rpc\Service\ThirdPlatformDocumentRpcService;
use Dtyq\MagicEnterprise\Application\Kernel\TeamshareMultipleEnvApiFactory;
use Dtyq\MagicEnterprise\Application\TeamshareOpenPlatform\Service\FIleOauth2AppService;
use Dtyq\MagicEnterprise\Application\TeamshareOpenPlatform\Service\Oauth2AuthenticationAppService;
use Dtyq\MagicEnterprise\Domain\TeamshareOpenPlatform\Entity\ValueObject\FileType;
use Dtyq\MagicEnterprise\Infrastructure\ExternalAPI\Teamshare\Oauth2\Teamshare\Api\Result\CommonResult;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

/**
 * @internal
 */
class ThirdPlatformDocumentRpcServiceTest extends TestCase
{
    public function testResolveShouldRejectMissingPlatformTypeBeforePreProcess(): void
    {
        $documentFileStrategy = $this->createMock(DocumentFileStrategy::class);
        $documentFileStrategy->expects($this->never())->method('preProcessDocumentFile');

        $service = $this->newService($documentFileStrategy, $this->createMock(FIleOauth2AppService::class));
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

        $service = $this->newService($documentFileStrategy, $this->createMock(FIleOauth2AppService::class));
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

        $service = $this->newService($documentFileStrategy, $this->createMock(FIleOauth2AppService::class));
        $result = $service->resolve($this->baseResolveParams());

        $this->assertSame(40404, $result['code']);
        $this->assertSame('resolve third_platform document failed: missing or unsupported file identifiers', $result['message']);
    }

    public function testResolveCloudDocumentShouldReturnRawMarkdownAndMdExtension(): void
    {
        $documentFile = $this->makeThirdPlatformDocumentFile((string) FileType::CLOUD_DOCUMENT, 'docx');
        $documentFileStrategy = $this->createMock(DocumentFileStrategy::class);
        $documentFileStrategy->expects($this->once())
            ->method('preProcessDocumentFile')
            ->with($this->isInstanceOf(KnowledgeBaseDataIsolation::class), $this->isInstanceOf(ThirdPlatformDocumentFile::class))
            ->willReturn($documentFile);
        $documentFileStrategy->expects($this->never())->method('parseContent');

        $fileOauth2AppService = $this->createMock(FIleOauth2AppService::class);
        $fileOauth2AppService->expects($this->once())
            ->method('getFileMarkdown')
            ->willReturn($this->rpcResult(['content' => '# Teamshare Markdown']));
        $fileOauth2AppService->expects($this->never())->method('getTeamshareFileDownloadUrls');

        $service = $this->newService($documentFileStrategy, $fileOauth2AppService);
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
        $documentFile = $this->makeThirdPlatformDocumentFile((string) FileType::MULTI_TABLE, 'xlsx');
        $documentFileStrategy = $this->createMock(DocumentFileStrategy::class);
        $documentFileStrategy->method('preProcessDocumentFile')->willReturn($documentFile);
        $documentFileStrategy->expects($this->never())->method('parseContent');

        $fileOauth2AppService = $this->createMock(FIleOauth2AppService::class);
        $fileOauth2AppService->expects($this->once())
            ->method('getFileMarkdown')
            ->willReturn($this->rpcResult([
                'content' => "## 表格\n| 城市 | 门店 |\n| --- | --- |\n| 上海 | 徐汇 |\n",
            ]));
        $fileOauth2AppService->expects($this->never())->method('getTeamshareFileDownloadUrls');

        $service = $this->newService($documentFileStrategy, $fileOauth2AppService);
        $result = $service->resolve($this->baseResolveParams());

        $this->assertSame(0, $result['code']);
        $this->assertSame('raw_content', $result['data']['source_kind']);
        $this->assertStringContainsString('城市: 上海,门店: 徐汇', $result['data']['raw_content']);
        $this->assertSame([], $result['data']['download_urls']);
        $this->assertSame('csv', $result['data']['document_file']['extension']);
    }

    public function testResolveBinaryFileShouldReturnDownloadUrlWithoutPhpParse(): void
    {
        $documentFile = $this->makeThirdPlatformDocumentFile((string) FileType::WORD, 'docx');
        $documentFileStrategy = $this->createMock(DocumentFileStrategy::class);
        $documentFileStrategy->method('preProcessDocumentFile')->willReturn($documentFile);
        $documentFileStrategy->expects($this->never())->method('parseContent');

        $fileOauth2AppService = $this->createMock(FIleOauth2AppService::class);
        $fileOauth2AppService->expects($this->never())->method('getFileMarkdown');
        $fileOauth2AppService->expects($this->once())
            ->method('getTeamshareFileDownloadUrls')
            ->willReturn($this->rpcResult([
                ['url' => 'https://download.example.com/demo.docx'],
            ]));

        $service = $this->newService($documentFileStrategy, $fileOauth2AppService);
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
        $documentFile = $this->makeThirdPlatformDocumentFile((string) FileType::EXCEL, 'xlsx');
        $documentFileStrategy = $this->createMock(DocumentFileStrategy::class);
        $documentFileStrategy->method('preProcessDocumentFile')->willReturn($documentFile);
        $documentFileStrategy->expects($this->never())->method('parseContent');

        $fileOauth2AppService = $this->createMock(FIleOauth2AppService::class);
        $fileOauth2AppService->expects($this->never())->method('getFileMarkdown');
        $fileOauth2AppService->expects($this->once())
            ->method('getTeamshareFileDownloadUrls')
            ->willReturn($this->rpcResult([
                [
                    'key' => 'DT001/demo/original.xlsx',
                    'url' => 'https://download.example.com/original.xlsx',
                ],
                [
                    'key' => 'DT001/demo/.xlsx',
                    'url' => 'https://download.example.com/export.xlsx',
                ],
            ]));

        $service = $this->newService($documentFileStrategy, $fileOauth2AppService);
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
        $fileOauth2AppService = $this->createMock(FIleOauth2AppService::class);
        $fileOauth2AppService->expects($this->never())->method('getFile');
        $fileOauth2AppService->expects($this->once())
            ->method('getChildFilesByParams')
            ->willReturn($this->rpcResult($rawChildren));

        $service = $this->newService($documentFileStrategy, $fileOauth2AppService);
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
        FIleOauth2AppService $fileOauth2AppService,
        ?Oauth2AuthenticationAppService $oauth2AuthenticationAppService = null,
        ?TeamshareMultipleEnvApiFactory $teamshareMultipleEnvApiFactory = null,
        ?LoggerInterface $logger = null,
    ): ThirdPlatformDocumentRpcService {
        return new ThirdPlatformDocumentRpcService(
            $documentFileStrategy,
            $fileOauth2AppService,
            $oauth2AuthenticationAppService ?? $this->createMock(Oauth2AuthenticationAppService::class),
            $teamshareMultipleEnvApiFactory ?? $this->createMock(TeamshareMultipleEnvApiFactory::class),
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

    private function rpcResult(array $data): CommonResult
    {
        return new CommonResult($data);
    }
}

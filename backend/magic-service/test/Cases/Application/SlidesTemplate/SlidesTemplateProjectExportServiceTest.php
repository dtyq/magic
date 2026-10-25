<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Application\SlidesTemplate;

use App\Application\SlidesTemplate\DTO\SlidesTemplateProjectExportResult;
use App\Application\SlidesTemplate\Service\SlidesTemplateProjectExportService;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateDataIsolation;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateEntity;
use App\ErrorCode\SlidesTemplateErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Exception\SandboxOperationException;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Workspace\Response\ExportWorkspaceResponse;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use ReflectionClass;

/**
 * @internal
 */
class SlidesTemplateProjectExportServiceTest extends TestCase
{
    public function testSandboxExportFailureReturnsActionableMessage(): void
    {
        $service = $this->makeService($this->createMock(CloudFileRepositoryInterface::class));
        $response = new ExportWorkspaceResponse(
            false,
            2000,
            'Slide template directory may be at most 200 MB.',
        );
        $method = (new ReflectionClass($service))->getMethod('throwSandboxFailure');
        $method->setAccessible(true);

        try {
            $method->invoke($service, $response->getMessage());
            $this->fail('Sandbox export failure must throw a business exception.');
        } catch (BusinessException $exception) {
            $this->assertSame(SlidesTemplateErrorCode::PROJECT_TEMPLATE_EXPORT_FAILED->value, $exception->getCode());
            $this->assertSame('Slide template directory may be at most 200 MB.', $exception->getMessage());
        }
    }

    public function testSandboxOperationExceptionReturnsOriginalMessage(): void
    {
        $service = $this->makeService($this->createMock(CloudFileRepositoryInterface::class));
        $sandboxException = new SandboxOperationException(
            'Initialize agent',
            'HTTP 503 error from gateway',
            503,
        );
        $method = (new ReflectionClass($service))->getMethod('throwSandboxFailure');
        $method->setAccessible(true);

        try {
            $method->invoke($service, $sandboxException->getMessage(), $sandboxException);
            $this->fail('Sandbox operation failure must throw a business exception.');
        } catch (BusinessException $exception) {
            $this->assertSame(SlidesTemplateErrorCode::PROJECT_TEMPLATE_EXPORT_FAILED->value, $exception->getCode());
            $this->assertSame('Initialize agent failed: HTTP 503 error from gateway', $exception->getMessage());
            $this->assertSame($sandboxException, $exception->getPrevious());
        }
    }

    public function testSandboxManifestCodeIsIgnored(): void
    {
        $result = SlidesTemplateProjectExportResult::fromSandbox(
            'SLIDE-97C53BC2',
            'ORG-1/open/slide-templates/SLIDE-97C53BC2/0123456789abcdef01234567/template.zip',
            [
                'code' => 'PPT-3d-glass-business-report',
                'label' => ['zh_CN' => '测试模板', 'en_US' => 'Test Template'],
                'description' => ['zh_CN' => '测试描述', 'en_US' => 'Test Description'],
                'thumbnail_file_key' => 'thumbnail.png',
            ],
            945287050710581249,
            945287124660424705,
        );

        $this->assertSame('SLIDE-97C53BC2', $result->toArray()['code']);
    }

    public function testInvalidSandboxManifestUsesBusinessErrorCode(): void
    {
        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(SlidesTemplateErrorCode::PROJECT_TEMPLATE_MANIFEST_INVALID->value);

        SlidesTemplateProjectExportResult::fromSandbox(
            'SLIDE-97C53BC2',
            'template.zip',
            ['label' => ['zh_CN' => '测试模板', 'en_US' => 'Test Template']],
            1,
            2,
        );
    }

    public function testCleanupExportedFilesDeletesPrivateAndPublicDirectories(): void
    {
        $repository = $this->createMock(CloudFileRepositoryInterface::class);
        $repository->expects($this->exactly(2))
            ->method('listObjectsByCredential')
            ->willReturnCallback(function (string $organizationCode, string $prefix, StorageBucketType $bucket): array {
                $this->assertSame('ORG-1', $organizationCode);
                $this->assertSame('slide-templates/template-code/0123456789abcdef01234567', $prefix);
                return [
                    'objects' => [[
                        'key' => 'ORG-1/open/' . $prefix . '/' . $bucket->value . '.dat',
                    ]],
                    'next_marker' => null,
                ];
            });
        $repository->expects($this->exactly(2))
            ->method('deleteObjectsByCredential')
            ->with(
                'slide-templates/template-code/0123456789abcdef01234567',
                'ORG-1',
                $this->callback(static fn (array $keys): bool => count($keys) === 1),
                $this->isInstanceOf(StorageBucketType::class),
                ['internal_endpoint' => true],
            );

        $this->makeService($repository)->cleanupExportedFiles(
            $this->makeDataIsolation(),
            ['code' => 'template-code'],
            '0123456789abcdef01234567',
        );
    }

    public function testCleanupPreviousTemplateDirectoryUsesPreviousRandomDirectory(): void
    {
        $repository = $this->createMock(CloudFileRepositoryInterface::class);
        $repository->expects($this->exactly(2))
            ->method('listObjectsByCredential')
            ->with(
                'ORG-1',
                'slide-templates/template-code/aaaaaaaaaaaaaaaaaaaaaaaa',
                $this->isInstanceOf(StorageBucketType::class),
                ['max-keys' => 1000],
            )
            ->willReturn(['objects' => [], 'next_marker' => null]);
        $repository->expects($this->never())->method('deleteObjectsByCredential');

        $template = (new SlidesTemplateEntity())
            ->setCode('template-code')
            ->setTemplateFileKey('ORG-1/open/slide-templates/template-code/aaaaaaaaaaaaaaaaaaaaaaaa/template.zip');

        $this->makeService($repository)->cleanupPreviousTemplateDirectory(
            $this->makeDataIsolation(),
            $template,
            'bbbbbbbbbbbbbbbbbbbbbbbb',
        );
    }

    private function makeService(CloudFileRepositoryInterface $repository): SlidesTemplateProjectExportService
    {
        $reflection = new ReflectionClass(SlidesTemplateProjectExportService::class);
        /** @var SlidesTemplateProjectExportService $service */
        $service = $reflection->newInstanceWithoutConstructor();
        $reflection->getProperty('cloudFileRepository')->setValue($service, $repository);
        $reflection->getProperty('logger')->setValue($service, new NullLogger());
        return $service;
    }

    private function makeDataIsolation(): SlidesTemplateDataIsolation
    {
        $reflection = new ReflectionClass(SlidesTemplateDataIsolation::class);
        /** @var SlidesTemplateDataIsolation $dataIsolation */
        $dataIsolation = $reflection->newInstanceWithoutConstructor();
        $dataIsolation->setCurrentOrganizationCode('ORG-1');
        $dataIsolation->setCurrentUserId('user-1');
        $dataIsolation->setEnabled(true);
        return $dataIsolation;
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\DataIsolation;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use App\Domain\SuperMagic\Agent\Service\SuperMagicAgentDomainService;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillDataIsolation;
use App\Domain\SuperMagic\Skill\Service\SkillDomainService;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Workspace\Request\ExportWorkspaceRequest;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Workspace\Response\ExportWorkspaceResponse;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Workspace\Response\ImportWorkspaceResponse;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Workspace\WorkspaceExporterInterface;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Workspace\WorkspaceImporterInterface;

/**
 * 使用 Mock 端口验证导出参数、异步调用和授权传递。
 * @internal
 */
final class WorkspaceAuthorizationTest extends ContextTestCase
{
    /** Agent 同步和异步导出保留当前排除路径、技能哈希及授权对象。 */
    public function testAgentExportsPreserveParametersAndAuthorization(): void
    {
        foreach (['export', 'createAsync'] as $operation) {
            $context = $this->authorizedContext();
            $cloud = $this->createMock(CloudFileRepositoryInterface::class);
            $cloud->method('getStsTemporaryCredential')->willReturn(['mock' => 'credential']);
            $exporter = $this->createMock(WorkspaceExporterInterface::class);
            $exporter->expects(self::once())->method($operation)->willReturnCallback(static function (DataIsolation $actual, string $sandboxId, ExportWorkspaceRequest $request) use ($context): ExportWorkspaceResponse {
                self::assertSame($context, $actual);
                self::assertSame('mock-token', $actual->getUserAuthorizationToken());
                self::assertSame('mock-sandbox', $sandboxId);
                self::assertSame('mock/path', $request->toArray()['source_path']);
                self::assertSame(['mock/excluded'], $request->toArray()['exclude_paths']);
                self::assertSame('mock-hash', $request->toArray()['skills_md_hash']);
                return new ExportWorkspaceResponse(true, 1000, 'mock success', 'mock/archive.zip');
            });
            $service = $this->service(SuperMagicAgentDomainService::class, ['cloudFileRepository' => $cloud, 'workspaceExporter' => $exporter]);
            $isolation = new SuperMagicAgentDataIsolation('mock-org', 'mock-user');
            if ($operation === 'export') {
                $result = $service->exportAgentFromSandbox($isolation, 'mock-code', 1, 'mock/workdir', 'mock-sandbox', $context, 'mock/path', ['mock/excluded'], 'mock-hash');
            } else {
                $result = $service->createAgentWorkspaceExportAsync($isolation, 'mock-code', 'mock-sandbox', 'mock/path', 'mock.zip', 'mock-task', $context, ['mock/excluded'], 'mock-hash');
            }
            self::assertSame('mock/archive.zip', $result['file_key']);
        }
    }

    /** Skill 同步和异步导出使用相同的 App 上下文，保留归档参数。 */
    public function testSkillExportsPreserveAuthorization(): void
    {
        foreach (['export', 'createAsync'] as $operation) {
            $context = $this->authorizedContext();
            $cloud = $this->createMock(CloudFileRepositoryInterface::class);
            $cloud->method('getStsTemporaryCredential')->willReturn(['mock' => 'credential']);
            $exporter = $this->createMock(WorkspaceExporterInterface::class);
            $exporter->expects(self::once())->method($operation)->willReturnCallback(static function (DataIsolation $actual, string $sandboxId, ExportWorkspaceRequest $request) use ($context): ExportWorkspaceResponse {
                self::assertSame($context, $actual);
                self::assertSame('mock-token', $actual->getUserAuthorizationToken());
                self::assertSame('mock-root', $request->getArchiveRoot());
                self::assertSame('mock.zip', $request->getFileName());
                return new ExportWorkspaceResponse(true, 1000, 'mock success', 'mock/archive.zip');
            });
            $service = $this->service(SkillDomainService::class, ['cloudFileRepository' => $cloud, 'workspaceExporter' => $exporter]);
            $isolation = new SkillDataIsolation('mock-org', 'mock-user');
            if ($operation === 'export') {
                $service->exportSkillFromSandbox($isolation, 'mock-code', 'mock-sandbox', 'mock/path', 'mock-root', 'mock.zip', $context);
            } else {
                $service->createSkillWorkspaceExportAsync($isolation, 'mock-code', 'mock-sandbox', 'mock/path', 'mock-root', 'mock.zip', 'mock-task', $context);
            }
        }
    }

    /** Agent 和 Skill 的轮询分别传入当前请求准备的授权对象。 */
    public function testAsyncStatusQueriesForwardAuthorization(): void
    {
        foreach ([SuperMagicAgentDomainService::class => SuperMagicAgentDataIsolation::class, SkillDomainService::class => SkillDataIsolation::class] as $class => $isolationClass) {
            $context = $this->authorizedContext();
            $exporter = $this->createMock(WorkspaceExporterInterface::class);
            $exporter->expects(self::once())->method('checkAsync')->with($context, 'mock-sandbox', 'mock-task')->willReturnCallback(static function (DataIsolation $actual): ExportWorkspaceResponse {
                self::assertSame('mock-token', $actual->getUserAuthorizationToken());
                return new ExportWorkspaceResponse(true, 1000, 'mock success');
            });
            $service = $this->service($class, ['workspaceExporter' => $exporter]);
            $method = $class === SkillDomainService::class ? 'checkSkillWorkspaceExportAsync' : 'checkAgentWorkspaceExportAsync';
            $service->{$method}(new $isolationClass('mock-org', 'mock-user'), 'mock-sandbox', 'mock-task', $context);
        }
    }

    /** Skill 导入保留传入用户授权，不依赖旧构造副作用。 */
    public function testSkillImportForwardsAuthorization(): void
    {
        $context = $this->authorizedContext();
        $importer = $this->createMock(WorkspaceImporterInterface::class);
        $importer->expects(self::once())->method('import')->willReturnCallback(static function (DataIsolation $actual) use ($context): ImportWorkspaceResponse {
            self::assertSame($context, $actual);
            self::assertSame('mock-token', $actual->getUserAuthorizationToken());
            return new ImportWorkspaceResponse(true, 1000, 'mock success', 'mock/dir', 1);
        });
        $service = $this->service(SkillDomainService::class, ['workspaceImporter' => $importer]);
        $service->importSkillWorkspaceFromSandbox(new SkillDataIsolation('mock-org', 'mock-user'), 'mock-sandbox', 'https://example.invalid/mock.zip', $context, 'mock/dir');
    }

    /** 创建仅返回合成 token 的 App 授权上下文。 */
    private function authorizedContext(): DataIsolation
    {
        $context = new DataIsolation('mock-org', 'mock-user');
        $context->addLazyFunction(BaseDataIsolation::USER_AUTHORIZATION_TOKEN_LAZY_FUNCTION, static fn (): string => 'mock-token');
        return $context;
    }
}

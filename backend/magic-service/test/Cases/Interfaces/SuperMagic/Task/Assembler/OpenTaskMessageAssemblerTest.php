<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\SuperMagic\Task\Assembler;

use App\Application\SuperMagic\File\Service\FileReferenceAppService;
use App\Application\SuperMagic\File\Service\TaskFileAuthorizationService;
use App\Application\SuperMagic\Message\Assembler\UserMessageDTOAssembler;
use App\Application\SuperMagic\Task\Service\TopicTaskAppService;
use App\Domain\Chat\DTO\Message\ChatMessage\RichTextMessage;
use App\Domain\SuperMagic\Common\Entity\ValueObject\SuperMagicExecutionSource;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Repository\Facade\TaskFileRepositoryInterface;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Util\Context\RequestCoContext;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\SuperMagic\Task\Assembler\OpenTaskMessageAssembler;
use App\Interfaces\SuperMagic\Task\DTO\Request\CreateOpenTaskRequestDTO;
use App\Interfaces\SuperMagic\Task\DTO\Request\CreateTaskRequestDTO;
use App\Interfaces\SuperMagic\Task\Facade\OpenApi\OpenTaskApi;
use HyperfTest\Cases\Application\SuperMagic\Support\OpenApiUnitTestTrait;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

/** @internal */
final class OpenTaskMessageAssemblerTest extends TestCase
{
    use OpenApiUnitTestTrait;

    public function testFacadePassesAnAuthorizedStandardMessageAndOpenOptionsToTaskCreation(): void
    {
        $authorization = $this->authorization();
        RequestCoContext::setUserAuthorization($authorization);
        $context = $this->createMock(RequestContext::class);
        $context->expects($this->once())->method('setUserAuthorization')->with($authorization);
        $tasks = $this->getMockBuilder(TopicTaskAppService::class)->disableOriginalConstructor()->onlyMethods(['createTaskFromOpenApi'])->getMock();
        $tasks->expects($this->once())->method('createTaskFromOpenApi')->with(
            $context,
            $this->callback(static fn (CreateOpenTaskRequestDTO $dto): bool => $dto->isAutoHireAgent()),
            $this->callback(static function (CreateTaskRequestDTO $dto): bool {
                $content = $dto->getMessageContent();
                $document = json_decode($content['content'], true);
                return $content['attachments'][0]['file_id'] === '12'
                    && $document['content'][1]['content'][0]['attrs']['data']['file_path'] === 'inputs/sales.csv';
            }),
        )->willReturn(['task_id' => '100']);
        $api = (new ReflectionClass(OpenTaskApi::class))->newInstanceWithoutConstructor();
        $this->inject($api, OpenTaskApi::class, [
            'request' => $this->requestWithData(['project_id' => '1', 'topic_id' => '2', 'content' => 'Read', 'file_ids' => ['12'], 'auto_hire_agent' => true]),
            'topicTaskAppService' => $tasks,
            'openTaskMessageAssembler' => $this->service(),
        ]);
        self::assertSame(['task_id' => '100'], $api->createTask($context));
    }

    public function testFileIdsUseParentChainPathsAndDeduplicateAttachments(): void
    {
        $service = $this->service();
        $dto = new CreateOpenTaskRequestDTO(['project_id' => '1', 'topic_id' => '2', 'content' => "Analyze\nsales", 'file_ids' => ['12', '12'], 'force_interrupt' => true]);
        $internal = $service->prepare($this->authorization(), $dto);
        $content = $internal->getMessageContent();
        $doc = json_decode($content['content'], true);
        self::assertCount(3, $doc['content']);
        self::assertSame('inputs/sales.csv', $doc['content'][2]['content'][0]['attrs']['data']['file_path']);
        self::assertSame('caller-unrelated-physical-key', $doc['content'][2]['content'][0]['attrs']['data']['file_key']);
        self::assertCount(1, $content['attachments']);
        self::assertSame('project_file', $content['attachments'][0]['type']);
        self::assertIsInt($content['attachments'][0]['file_type']);
        self::assertTrue($internal->isForceInterrupt());
        $fields = UserMessageDTOAssembler::parseMessageContent(new RichTextMessage($content), SuperMagicExecutionSource::OpenApi);
        self::assertSame('inputs/sales.csv', json_decode($fields['mentions'], true)[0]['file_path']);
    }

    public function testRichMentionsRetainPositionAndReplaceUntrustedFileMetadata(): void
    {
        $file = ['type' => 'mention', 'attrs' => ['type' => 'project_file', 'data' => ['file_id' => '12', 'file_path' => 'forged/path', 'file_name' => 'forged', 'project_id' => '99']]];
        $directory = ['type' => 'mention', 'attrs' => ['type' => 'project_directory', 'data' => ['directory_id' => '11', 'directory_metadata' => ['type' => 'design']]]];
        $doc = ['type' => 'doc', 'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Before'], $file, ['type' => 'text', 'text' => 'Between'], $directory, $file]]]];
        $rich = [
            'content' => json_encode($doc),
            'instructs' => [['value' => 'follow_up']],
            'extra' => ['super_agent' => [
                'model' => ['model_id' => 'model', 'model_name' => 'Model', 'model_icon' => 'icon'],
                'video_model' => ['model_id' => 'video'],
                'dynamic_params' => ['message_version' => 'v2'],
                'processed_by_api' => true, 'source' => ['channel' => 'fake'], 'queue_id' => 'fake',
            ]],
        ];
        $content = $this->service()->prepare($this->authorization(), new CreateOpenTaskRequestDTO(['project_id' => '1', 'topic_id' => '2', 'content_type' => 'rich_text', 'rich_content' => $rich]))->getMessageContent();
        $nodes = json_decode($content['content'], true)['content'][0]['content'];
        self::assertSame('Between', $nodes[2]['text']);
        self::assertSame('sales.csv', $nodes[1]['attrs']['data']['file_name']);
        self::assertSame('inputs/sales.csv', $nodes[4]['attrs']['data']['file_path']);
        self::assertSame('slide', $nodes[3]['attrs']['data']['directory_metadata']['type']);
        self::assertSame('inputs/', $nodes[3]['attrs']['data']['directory_path']);
        self::assertCount(1, $content['attachments']);
        self::assertSame($rich['extra']['super_agent']['model'], $content['extra']['super_agent']['model']);
        self::assertSame('v2', $content['extra']['super_agent']['dynamic_params']['message_version']);
        self::assertArrayNotHasKey('processed_by_api', $content['extra']['super_agent']);
        self::assertArrayNotHasKey('source', $content['extra']['super_agent']);
        self::assertArrayNotHasKey('queue_id', $content['extra']['super_agent']);
    }

    public function testExplicitMentionsAreCheckedWithoutBeingMergedWithBody(): void
    {
        $body = ['type' => 'mention', 'attrs' => ['type' => 'project_file', 'data' => ['file_id' => '12']]];
        $explicit = ['type' => 'mention', 'attrs' => ['type' => 'project_directory', 'data' => ['directory_id' => '11']]];
        $rich = ['content' => json_encode(['type' => 'doc', 'content' => [['type' => 'paragraph', 'content' => [$body]]]]), 'extra' => ['super_agent' => ['mentions' => [$explicit]]]];
        $content = $this->service()->prepare($this->authorization(), new CreateOpenTaskRequestDTO(['project_id' => '1', 'topic_id' => '2', 'content_type' => 'rich_text', 'rich_content' => $rich]))->getMessageContent();
        $fields = UserMessageDTOAssembler::parseMessageContent(new RichTextMessage($content), SuperMagicExecutionSource::OpenApi);
        $mentions = json_decode($fields['mentions'], true);
        self::assertCount(1, $mentions);
        self::assertSame('11', $mentions[0]['directory_id']);
    }

    public function testUnavailableFilesCannotBecomeTrustedReferences(): void
    {
        $this->expectException(BusinessException::class);
        $this->service(false)->prepare($this->authorization(), new CreateOpenTaskRequestDTO(['project_id' => '1', 'topic_id' => '2', 'content' => 'Read', 'file_ids' => ['12']]));
    }

    public function testParagraphAttributesDoNotBecomeFileReferences(): void
    {
        $doc = ['type' => 'doc', 'content' => [['type' => 'paragraph', 'attrs' => ['type' => 'project_file'], 'content' => [['type' => 'text', 'text' => 'Read']]]]];
        $rich = ['content' => json_encode($doc)];
        $content = $this->service()->prepare($this->authorization(), new CreateOpenTaskRequestDTO(['project_id' => '1', 'topic_id' => '2', 'content_type' => 'rich_text', 'rich_content' => $rich]))->getMessageContent();
        self::assertArrayNotHasKey('attachments', $content);
        self::assertSame($doc, json_decode($content['content'], true));
    }

    public function testFileIdsCannotTreatDirectoriesAsFiles(): void
    {
        $this->expectException(BusinessException::class);
        $this->service()->prepare($this->authorization(), new CreateOpenTaskRequestDTO(['project_id' => '1', 'topic_id' => '2', 'content' => 'Read', 'file_ids' => ['11']]));
    }

    private function service(bool $authorized = true): OpenTaskMessageAssembler
    {
        $root = new TaskFileEntity(['file_id' => 10, 'project_id' => 1, 'parent_id' => null, 'file_name' => '/', 'is_directory' => true, 'organization_code' => 'owner-org']);
        $directory = new TaskFileEntity(['file_id' => 11, 'project_id' => 1, 'parent_id' => 10, 'file_name' => 'inputs', 'is_directory' => true, 'organization_code' => 'owner-org', 'display_config' => '{"type":"slide","version":"1.0.0"}', 'metadata' => '{"type":"design"}']);
        $file = new TaskFileEntity(['file_id' => 12, 'project_id' => 1, 'parent_id' => 11, 'file_name' => 'sales.csv', 'file_extension' => 'csv', 'file_size' => 55, 'file_key' => 'caller-unrelated-physical-key', 'organization_code' => 'owner-org']);
        $entities = [10 => $root, 11 => $directory, 12 => $file];
        $files = $this->createMock(TaskFileDomainService::class);
        $files->method('getFilesByIds')->willReturnCallback(static fn (array $ids): array => array_values(array_intersect_key($entities, array_flip($ids))));
        $files->method('getFilesWithParentsByIds')->willReturn(array_values($entities));
        $repository = $this->createMock(TaskFileRepositoryInterface::class);
        $repository->method('findRootDirectoryByProjectId')->willReturn($root);
        $authorization = $this->createMock(TaskFileAuthorizationService::class);
        $authorization->method('authorizeFilesByIds')->willReturnCallback(static fn ($user, array $ids): array => $authorized ? array_values(array_intersect_key($entities, array_flip($ids))) : []);
        return new OpenTaskMessageAssembler(new FileReferenceAppService($files, $repository, $authorization), $files);
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\SuperMagic\Task\DTO\Request;

use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\SuperMagic\Utils\TiptapBuilder;
use App\Interfaces\SuperMagic\Task\DTO\Request\CreateOpenTaskRequestDTO;
use App\Interfaces\SuperMagic\Task\DTO\Request\CreateTaskRequestDTO;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Validation\ValidationException;
use Hyperf\Validation\ValidatorFactory;
use HyperfTest\Cases\Application\SuperMagic\Support\OpenApiUnitTestTrait;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

/**
 * @internal
 */
final class CreateOpenTaskRequestDTOTest extends TestCase
{
    use OpenApiUnitTestTrait;

    public function testValidatedBooleanRepresentationsAreConvertedWithoutTypeErrors(): void
    {
        $dto = CreateOpenTaskRequestDTO::fromRequest($this->requestWithData(['project_id' => '1', 'topic_id' => '2', 'content' => 'hello', 'force_interrupt' => '1', 'enable_web_search' => '0']));
        self::assertTrue($dto->toCreateTaskRequestDTO()->isForceInterrupt());
        self::assertFalse($dto->toCreateTaskRequestDTO()->getMessageContent()['extra']['super_agent']['enable_web_search']);
        $internal = CreateTaskRequestDTO::fromValidatedArray(['project_id' => '1', 'topic_id' => '2', 'message_type' => 'text', 'message_content' => ['content' => 'hello'], 'force_interrupt' => '0']);
        self::assertFalse($internal->isForceInterrupt());
    }

    public function testRichContentIsIndependentAndStandardConfigurationIsPreserved(): void
    {
        $rich = [
            'content' => TiptapBuilder::plainTextToJson('hello'),
            'instructs' => [['value' => 'follow_up', 'instruction' => null]],
            'extra' => ['super_agent' => ['agent_code' => null, 'model' => ['model_id' => 'model-1', 'model_name' => 'Model'], 'video_model' => ['model_id' => 'video-1'], 'dynamic_params' => ['message_version' => 'v2']]],
        ];
        $dto = CreateOpenTaskRequestDTO::fromRequest($this->requestWithData(['project_id' => '1', 'topic_id' => '2', 'content_type' => 'rich_text', 'rich_content' => $rich, 'force_interrupt' => true, 'auto_hire_agent' => true]));
        self::assertSame('', $dto->getContent());
        self::assertSame($rich, $dto->toCreateTaskRequestDTO()->getMessageContent());
        self::assertTrue($dto->toCreateTaskRequestDTO()->isForceInterrupt());
        self::assertTrue($dto->isAutoHireAgent());
    }

    #[DataProvider('conflictingBodies')]
    public function testBodyConflictsAreRejectedAtRequestBoundary(array $options): void
    {
        $this->expectException(BusinessException::class);
        CreateOpenTaskRequestDTO::fromRequest($this->requestWithData(array_merge(['project_id' => '1', 'topic_id' => '2'], $options)));
    }

    public static function conflictingBodies(): array
    {
        $rich = ['content' => TiptapBuilder::plainTextToJson('hello')];
        return [
            'two bodies' => [['content_type' => 'rich_text', 'content' => 'hello', 'rich_content' => $rich]],
            'flat config' => [['content_type' => 'rich_text', 'rich_content' => $rich, 'agent_mode' => 'general']],
            'file ids with rich' => [['content_type' => 'rich_text', 'rich_content' => $rich, 'file_ids' => ['1']]],
            'rich in text' => [['content' => 'hello', 'rich_content' => $rich]],
            'missing text' => [[]],
            'non-doc json' => [['content_type' => 'rich_text', 'rich_content' => ['content' => '{}']]],
            'invalid json' => [['content_type' => 'rich_text', 'rich_content' => ['content' => '{']]],
            'overflow id' => [['content' => 'hello', 'file_ids' => ['9223372036854775808']]],
            'keyed ids' => [['content' => 'hello', 'file_ids' => ['file' => '1']]],
        ];
    }

    public function testContentRemainsAStringAndConvertedMessagesRunFinalValidation(): void
    {
        $this->expectException(ValidationException::class);
        CreateTaskRequestDTO::fromValidatedArray(['project_id' => '1', 'topic_id' => '2', 'message_type' => 'rich_text', 'message_content' => ['content' => str_repeat('a', 65001)]]);
    }

    public function testObjectContentIsRejectedWithoutGuessingTheInputFormat(): void
    {
        $this->expectException(ValidationException::class);
        CreateOpenTaskRequestDTO::fromRequest($this->requestWithData(['project_id' => '1', 'topic_id' => '2', 'content' => ['content' => 'hello']]));
    }

    #[DataProvider('autoHireValues')]
    public function testAutoHireValidationAndDefault(array $options, bool $valid, ?bool $expected): void
    {
        $data = array_merge(['project_id' => '1', 'topic_id' => '2', 'content' => 'Analyze sales'], $options);
        $translator = $this->createMock(TranslatorInterface::class);
        $translator->method('trans')->willReturnCallback(static fn (string $key) => $key);
        $rules = (new ReflectionMethod(CreateOpenTaskRequestDTO::class, 'getHyperfValidationRules'))->invoke(null);
        $validator = (new ValidatorFactory($translator))->make($data, $rules);
        self::assertSame($valid, $validator->passes());
        if ($valid) {
            self::assertSame($expected, (new CreateOpenTaskRequestDTO($data))->isAutoHireAgent());
        }
    }

    public static function autoHireValues(): array
    {
        return [
            'omitted' => [[], true, false],
            'disabled' => [['auto_hire_agent' => false], true, false],
            'enabled' => [['auto_hire_agent' => true], true, true],
            'integer enabled' => [['auto_hire_agent' => 1], true, true],
            'integer disabled' => [['auto_hire_agent' => 0], true, false],
            'string enabled' => [['auto_hire_agent' => '1'], true, true],
            'string disabled' => [['auto_hire_agent' => '0'], true, false],
            'invalid integer' => [['auto_hire_agent' => 2], false, null],
            'null' => [['auto_hire_agent' => null], false, null],
            'string' => [['auto_hire_agent' => 'false'], false, null],
            'array' => [['auto_hire_agent' => []], false, null],
        ];
    }

    public function testAutoHireRemainsOutsideTheAgentMessage(): void
    {
        $dto = new CreateOpenTaskRequestDTO([
            'project_id' => '1', 'topic_id' => '2', 'content' => 'Analyze sales',
            'agent_mode' => 'SMA-sales', 'auto_hire_agent' => true,
        ]);
        $content = $dto->toCreateTaskRequestDTO()->getMessageContent();
        self::assertSame('SMA-sales', $content['extra']['super_agent']['topic_pattern']);
        self::assertArrayNotHasKey('auto_hire_agent', $content['extra']['super_agent']);
    }
}

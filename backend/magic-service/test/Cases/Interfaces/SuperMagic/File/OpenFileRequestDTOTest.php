<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\SuperMagic\File;

use App\Infrastructure\Core\Exception\BusinessException;
use App\Interfaces\SuperMagic\File\DTO\Request\OpenBatchSaveProjectFilesRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\UploadProjectFileRequestDTO;
use Hyperf\Validation\ValidationException;
use HyperfTest\Cases\Application\SuperMagic\Support\OpenApiUnitTestTrait;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Swow\Psr7\Message\UploadedFile;

/** @internal */
final class OpenFileRequestDTOTest extends TestCase
{
    use OpenApiUnitTestTrait;

    public function testBatchRequestValidatesSingleAndMultipleFilesAndNullableParent(): void
    {
        $files = [['file_key' => 'org/project/workspace/a', 'file_name' => 'a.csv']];
        $dto = OpenBatchSaveProjectFilesRequestDTO::fromRequest($this->requestWithData(['project_id' => '1', 'parent_id' => null, 'files' => $files]));
        self::assertSame('', $dto->getParentId());
        self::assertSame($files, $dto->getFiles());
        $files[] = ['file_key' => 'org/project/workspace/b', 'file_name' => 'b.csv'];
        self::assertCount(2, OpenBatchSaveProjectFilesRequestDTO::fromRequest($this->requestWithData(['project_id' => '1', 'files' => $files]))->getFiles());
    }

    #[DataProvider('invalidKeys')]
    public function testKeysAreNotTrimmedOrNormalizedIntoDifferentResponseIdentities(string $key): void
    {
        $this->expectException(BusinessException::class);
        OpenBatchSaveProjectFilesRequestDTO::fromRequest($this->requestWithData(['project_id' => '1', 'files' => [['file_key' => $key, 'file_name' => 'a.csv']]]));
    }

    public static function invalidKeys(): array
    {
        return [[' org/a'], ['org/a '], ['org//a'], ['org/../a'], ['org/./a'], ['org\a'], ['0'], ["org/a\0"]];
    }

    public function testDuplicateKeysCannotOverwriteResultItems(): void
    {
        $this->expectException(BusinessException::class);
        OpenBatchSaveProjectFilesRequestDTO::fromRequest($this->requestWithData(['project_id' => '1', 'files' => [['file_key' => 'org/a', 'file_name' => 'a'], ['file_key' => 'org/a', 'file_name' => 'b']]]));
    }

    public function testMalformedBatchIsActuallyValidated(): void
    {
        $this->expectException(ValidationException::class);
        OpenBatchSaveProjectFilesRequestDTO::fromRequest($this->requestWithData(['project_id' => '1', 'files' => [['file_key' => 'org/a']]]));
    }

    public function testProjectCannotFallBackToUserSpaceOrOverflow(): void
    {
        $this->expectException(BusinessException::class);
        OpenBatchSaveProjectFilesRequestDTO::fromRequest($this->requestWithData(['project_id' => '9223372036854775808', 'files' => [['file_key' => 'org/a', 'file_name' => 'a']]]));
    }

    public function testMultipartRequiresACompletedNativeUpload(): void
    {
        $request = $this->requestWithData(['project_id' => '1']);
        $request->method('file')->willReturn(new UploadedFile('', error: UPLOAD_ERR_PARTIAL));
        $this->expectException(BusinessException::class);
        UploadProjectFileRequestDTO::fromRequest($request);
    }
}

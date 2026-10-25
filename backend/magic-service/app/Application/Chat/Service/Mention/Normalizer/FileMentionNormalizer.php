<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service\Mention\Normalizer;

use App\Application\Chat\Service\Mention\MentionNormalizerInterface;
use App\Application\SuperMagic\File\Service\FileReferenceAppService;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionType;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileSpaceType;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\File\DTO\Request\FileReferenceSelectorDTO;
use App\Interfaces\SuperMagic\File\DTO\Response\FileReferenceDTO;
use App\Interfaces\SuperMagic\File\DTO\Response\FileReferenceStatus;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

/**
 * 文件 mention 尽力按真实记录重建路径：解析成功时用服务端路径覆盖客户端声明值。
 *
 * 解析失败（记录已删除、无权限、父链断裂等）不阻断会话，只记 warning 并原样透传该条 mention，
 * 由 agent 自行判断文件是否存在。取舍：未解析时会保留客户端声明的 file_path/project_id，
 * 但 user/memory 类 mention 不参与跨项目挂载规划，伪造路径只影响用户自己有权访问的工作区。
 */
final class FileMentionNormalizer implements MentionNormalizerInterface
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly FileReferenceAppService $references,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('FileMentionNormalizer');
    }

    public function normalize(array $item, BaseDataIsolation $dataIsolation): array
    {
        return $this->normalizeMany([$item], $dataIsolation)[0];
    }

    /** @param array<int, array<string, mixed>> $items */
    public function normalizeMany(array $items, BaseDataIsolation $dataIsolation): array
    {
        $selectors = [];
        $indices = [];
        foreach ($items as $index => $item) {
            $id = $item['file_id'] ?? $item['directory_id'] ?? null;
            $selector = FileReferenceSelectorDTO::fromInput(['file_id' => $id]);

            if (! $selector->isValid()) {
                // 缺 file_id 的 mention（含身份型 user/memory 文件、历史只存路径的项目目录）无法按记录重建，
                // 记 warning 后原样透传，不阻断会话。
                $this->logger->warning('[FileMentionNormalizer] mention has no valid file id, passing through', [
                    'type' => $item['type'] ?? null,
                    'file_id' => $id,
                ]);
                continue;
            }
            $indices[] = $index;
            $selectors[] = $selector;
        }
        if ($selectors === []) {
            return $items;
        }

        $authorization = (new MagicUserAuthorization())
            ->setId($dataIsolation->getCurrentUserId())
            ->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $results = $this->references->resolve($authorization, $selectors);
        foreach ($results as $position => $result) {
            if ($result->status !== FileReferenceStatus::Resolved || $result->reference === null) {
                // 文件记录已删除 / 无权限 / 父链断裂：不阻断会话，记 warning 并保留原始 mention 交给 agent 判断。
                $this->logger->warning('[FileMentionNormalizer] file reference unresolved, passing through', [
                    'type' => $items[$indices[$position]]['type'] ?? null,
                    'file_id' => $items[$indices[$position]]['file_id'] ?? null,
                    'status' => $result->status->value,
                ]);
                continue;
            }
            $index = $indices[$position];
            $items[$index] = $this->applyReference($items[$index], $result->reference);
        }

        return $items;
    }

    private function applyReference(array $item, FileReferenceDTO $reference): array
    {
        $isUser = $reference->spaceType === FileSpaceType::USER;
        $path = ($isUser ? '~/' : '') . $reference->spaceRelativePath;
        // 用户结果使用白名单构造，旧 project_id、source_*、pending_project_copy 不得遗留。
        $result = $isUser ? [] : $item;
        if (! $isUser) {
            $result['project_id'] = $reference->projectId;
        }
        if ($reference->isDirectory) {
            return array_merge($result, [
                'type' => ($isUser ? MentionType::USER_DIRECTORY : MentionType::PROJECT_DIRECTORY)->value,
                'directory_id' => $reference->fileId,
                'directory_name' => $reference->fileName,
                'directory_path' => rtrim($path, '/') . '/',
            ]);
        }
        return array_merge($result, [
            'type' => ($isUser ? MentionType::USER_FILE : MentionType::PROJECT_FILE)->value,
            'file_id' => $reference->fileId,
            'file_name' => $reference->fileName,
            'file_path' => $path,
            'file_extension' => $reference->fileExtension,
        ]);
    }
}

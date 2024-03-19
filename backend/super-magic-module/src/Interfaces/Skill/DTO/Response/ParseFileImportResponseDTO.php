<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\DTO\Response;

use JsonSerializable;

/**
 * 解析文件导入响应 DTO.
 */
class ParseFileImportResponseDTO implements JsonSerializable
{
    /**
     * 导入 token.
     */
    private string $importToken;

    /**
     * Skill 包唯一标识名.
     */
    private string $packageName;

    /**
     * Skill 包描述.
     */
    private string $packageDescription;

    /**
     * 是否为更新场景.
     */
    private bool $isUpdate;

    /**
     * Skill 唯一标识码（更新场景）.
     */
    private ?string $skillCode = null;

    /**
     * Skill ID（更新场景）.
     */
    private ?int $skillId = null;

    /**
     * 多语言名称.
     */
    private array $nameI18n;

    /**
     * 多语言描述.
     */
    private array $descriptionI18n;

    /**
     * Logo 图片 URL.
     */
    private string $logo;

    public function __construct(
        string $importToken,
        string $packageName,
        string $packageDescription,
        bool $isUpdate,
        array $nameI18n,
        array $descriptionI18n,
        string $logo = '',
        ?string $skillCode = null,
        ?int $skillId = null
    ) {
        $this->importToken = $importToken;
        $this->packageName = $packageName;
        $this->packageDescription = $packageDescription;
        $this->isUpdate = $isUpdate;
        $this->nameI18n = $nameI18n;
        $this->descriptionI18n = $descriptionI18n;
        $this->logo = $logo;
        $this->skillCode = $skillCode;
        $this->skillId = $skillId;
    }

    public function jsonSerialize(): array
    {
        $result = [
            'import_token' => $this->importToken,
            'package_name' => $this->packageName,
            'package_description' => $this->packageDescription,
            'is_update' => $this->isUpdate,
            'name_i18n' => $this->nameI18n,
            'description_i18n' => $this->descriptionI18n,
            'logo' => $this->logo,
        ];

        if ($this->isUpdate) {
            $result['code'] = $this->skillCode;
            $result['skill_id'] = (string) $this->skillId;
        } else {
            $result['code'] = null;
            $result['skill_id'] = null;
        }

        return $result;
    }
}

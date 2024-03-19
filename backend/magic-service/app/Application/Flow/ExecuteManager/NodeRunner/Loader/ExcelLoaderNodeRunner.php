<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\Loader;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunner;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Loader\ExcelLoaderNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\FlowNodeDefine;
use App\Infrastructure\Core\Dag\VertexResult;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\FileType;
use App\Infrastructure\Util\SSRF\SSRFUtil;
use Vtiful\Kernel\Excel;

#[FlowNodeDefine(type: NodeType::ExcelLoader->value, code: NodeType::ExcelLoader->name, name: '电子表格解析', paramsConfig: ExcelLoaderNodeParamsConfig::class, version: 'v0', singleDebug: true, needInput: false, needOutput: true)]
class ExcelLoaderNodeRunner extends NodeRunner
{
    protected function run(VertexResult $vertexResult, ExecutionData $executionData, array $frontResults): void
    {
        /** @var ExcelLoaderNodeParamsConfig $paramsConfig */
        $paramsConfig = $this->node->getNodeParamsConfig();

        $filesComponent = $paramsConfig->getFiles();
        $files = $filesComponent->getForm()->getKeyValue($executionData->getExpressionFieldData()) ?? [];
        if (! is_array($files)) {
            $files = [];
        }
        $files = array_filter($files);

        $filesSpreadsheet = [];
        foreach ($files as $file) {
            $fileUrl = $file['file_url'] ?? ($file['url'] ?? '');
            if (empty($fileUrl)) {
                ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'common.empty', ['label' => 'file_url']);
            }
            $fileName = $file['file_name'] ?? ($file['name'] ?? $fileUrl);

            $link = SSRFUtil::getSafeUrl($fileUrl, replaceIp: false);

            // 根据链接获取文件类型，这里只获取后缀可能不准确
            $fileExtension = FileType::getType($link);
            if (! in_array($fileExtension, ['xlsx', 'xls'])) {
                ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, 'flow.node.loader.unsupported_file_type', ['file_extension' => $fileExtension]);
            }

            $sheets = $this->excel($link, $fileExtension);
            $filesSpreadsheet[] = [
                'file_name' => $fileName,
                'file_url' => $fileUrl,
                'file_extension' => $fileExtension,
                'sheets' => $sheets,
            ];
        }

        $result = [
            'files_spreadsheet' => $filesSpreadsheet,
        ];
        $vertexResult->setResult($result);
        $executionData->saveNodeContext($this->node->getNodeId(), $result);
    }

    private function excel(string $url, string $fileExtension): array
    {
        $tempFile = tempnam(sys_get_temp_dir(), 'excel_') . '.' . $fileExtension;
        try {
            $inputStream = fopen($url, 'r');
            if (! $inputStream) {
                ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, sprintf('Download remote file failed: %s', $url));
            }
            $outputStream = fopen($tempFile, 'w');
            // 读取输入流并写入到输出流
            while ($data = fread($inputStream, 1024)) {
                fwrite($outputStream, $data);
            }
            @fclose($inputStream);
            @fclose($outputStream);

            $excel = new Excel([
                'path' => sys_get_temp_dir(),
            ]);
            $excelFile = $excel->openFile(basename($tempFile));
            $sheetList = $excelFile->sheetList();
            $sheetResults = [];
            foreach ($sheetList as $sheetName) {
                $rows = [];
                $sheet = $excelFile->openSheet($sheetName, Excel::SKIP_EMPTY_CELLS);
                $rowIndex = 0;
                /* @phpstan-ignore-next-line */
                while (($row = $sheet->nextRow()) !== null) {
                    ++$rowIndex;
                    if (empty($row)) {
                        // 跳过空白行
                        continue;
                    }

                    $cells = [];
                    foreach ($row as $cellIndex => $cellValue) {
                        $cells[] = [
                            'value' => (string) $cellValue,
                            'column_index' => Excel::stringFromColumnIndex($cellIndex),
                        ];
                    }
                    $rows[] = [
                        'row_index' => $rowIndex,
                        'cells' => $cells,
                    ];
                }
                /* @phpstan-ignore-next-line */
                $sheetResults[] = [
                    'sheet_name' => $sheetName,
                    'rows' => $rows,
                ];
            }
            return $sheetResults;
        } finally {
            if (isset($inputStream) && is_resource($inputStream)) {
                @fclose($inputStream);
            }
            if (isset($outputStream) && is_resource($outputStream)) {
                @fclose($outputStream);
            }
            @unlink($tempFile);
        }
    }
}

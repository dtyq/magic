"""
文件转换API路由

提供将HTML、Markdown等格式文件转换为PDF或PPTX的HTTP接口
"""

import asyncio
import traceback
from typing import Any, Dict, List, Optional, Union

from fastapi import APIRouter
from loguru import logger
from pydantic import BaseModel, Field, ValidationError, field_validator

from app.api.http_dto.response import BaseResponse, create_error_response, create_success_response
from app.core.entity.aigc_metadata import AigcMetadataParams
from app.service.convert_task_manager import TaskStatus, task_manager
from app.service.file_convert.pdf_convert_service import PdfConvertService
from app.service.file_convert.pptx_convert_service import PptxConvertService

router = APIRouter(prefix="/file", tags=["文件转换"])


class FileKeyItem(BaseModel):
    """文件Key项模型"""

    file_key: str = Field(description="文件key，指向workspace中的文件路径")


class STSTemporaryCredential(BaseModel):
    """STS临时凭证模型 - 支持不同平台的灵活结构"""

    platform: str = Field(description="平台类型，如 'aliyun', 'tos' 等")
    temporary_credential: Dict[str, Any] = Field(description="临时凭证信息，不同平台结构不同")
    expires: Optional[int] = Field(default=None, description="过期时间")
    magic_service_host: Optional[str] = Field(default=None, description="魔法服务主机地址")


class FileConvertRequest(BaseModel):
    """文件转换请求模型"""

    file_keys: Union[List[str], List[FileKeyItem]] = Field(
        description="要转换的文件key列表，支持字符串数组或对象数组格式"
    )
    options: Optional[Dict[str, Any]] = Field(default=None, description="转换选项")
    is_debug: bool = Field(default=False, description="是否为调试模式")
    output_format: Optional[str] = Field(
        default="auto", description="输出格式：auto(自动), zip(压缩包), single(单文件)"
    )
    convert_type: Optional[str] = Field(default="pdf", description="转换类型：pdf, ppt, pptx")
    task_key: Optional[str] = Field(
        default=None, description="任务标识符，用于跟踪转换状态和查询结果。如果不提供，系统会自动生成"
    )
    sts_temporary_credential: Optional[STSTemporaryCredential] = Field(
        default=None, description="STS临时凭证，用于上传到指定的OSS目录"
    )
    user_id: Optional[str] = Field(default=None, description="用户ID，用于图片元数据标识")
    organization_code: Optional[str] = Field(default=None, description="组织代码，用于图片元数据标识")
    topic_id: Optional[str] = Field(default=None, description="话题ID，用于图片元数据标识")

    @field_validator("file_keys", mode="before")
    @classmethod
    def convert_file_keys(cls, v):
        """
        验证并转换file_keys格式
        支持字符串数组和对象数组两种格式
        """
        if not v:
            raise ValueError("文件key列表不能为空")

        # 如果是字符串数组，转换为对象数组
        if isinstance(v, list) and len(v) > 0:
            if isinstance(v[0], str):
                # 字符串数组格式，转换为FileKeyItem对象数组
                return [FileKeyItem(file_key=file_key) for file_key in v]
            elif isinstance(v[0], dict):
                # 已经是对象数组格式，验证结构
                return [FileKeyItem(**item) for item in v]
            elif isinstance(v[0], FileKeyItem):
                # 已经是FileKeyItem对象数组
                return v

        raise ValueError("file_keys必须是字符串数组或对象数组")

    class Config:
        json_schema_extra = {
            "example": {
                "file_keys": ["DT001/.../project_.../ai-funding-report/index.html"],
                "options": {},
                "output_format": "zip",
                "convert_type": "pptx",
                "is_debug": False,
                "task_key": "task_20240101_123456",
                "sts_temporary_credential": {
                    "platform": "aliyun",
                    "temporary_credential": {
                        # 不同平台的结构可以不同
                        # aliyun平台的示例结构
                        "host": "example.oss-cn-beijing.aliyuncs.com",
                        "region": "oss-cn-beijing",
                        "endpoint": "https://oss-cn-beijing.aliyuncs.com",
                        "credentials": {
                            "AccessKeyId": "STS.xxx",
                            "SecretAccessKey": "xxx",
                            "SessionToken": "xxx",
                            "ExpiredTime": "2024-01-01T12:00:00Z",
                            "CurrentTime": "2024-01-01T10:00:00Z",
                        },
                        "bucket": "example-bucket",
                        "dir": "uploads/",
                        "expires": 3600,
                        "callback": "https://callback.example.com",
                    },
                    "expires": 3600,
                    "magic_service_host": "https://magic.example.com",
                },
            }
        }


@router.post("/converts", response_model=BaseResponse)
async def convert_files(request_data: dict) -> BaseResponse:
    """
    批量将文件转换为指定格式（PDF, PPTX等）

    - **convert_type**: 'pdf'
      - 支持通过file_keys模式传入文件key列表。
      - 转换后的文件会自动上传到对象存储，并返回预签名下载链接。
    - **convert_type**: 'ppt' 或 'pptx'
      - 支持通过file_keys模式传入文件key列表。
      - 会将所有输入文件（HTML/Markdown）渲染为图片，并合并到一个PPTX文件中的不同幻灯片。
      - 如果检测到PPT入口文件，会自动处理slides数组中的所有HTML文件。
      - 结果将以ZIP包形式返回。

    Args:
        request_data: 文件转换请求数据（字典格式）

    Returns:
        BaseResponse: 包含转换结果和下载链接的响应
    """
    try:
        # 打印完整的请求参数用于调试
        logger.info(f"收到文件转换请求，完整参数: {request_data}")
        logger.info(f"请求数据类型: {type(request_data)}")
        logger.info(f"请求数据键: {list(request_data.keys()) if isinstance(request_data, dict) else 'Not a dict'}")

        # 手动进行 Pydantic 验证
        try:
            request = FileConvertRequest(**request_data)
            logger.info("请求参数验证通过")
        except ValidationError as ve:
            # 详细记录验证错误
            error_details = ve.errors()
            logger.error(f"请求参数验证失败，错误详情: {error_details}")

            # 友好的错误消息处理
            friendly_errors = []
            serializable_errors = []

            for error in error_details:
                field = ".".join(str(loc) for loc in error.get("loc", []))
                msg = error.get("msg", "未知错误")
                error_type = error.get("type", "")

                if error_type == "missing":
                    friendly_errors.append(f"缺少必填字段: {field}")
                elif "type" in error_type:
                    friendly_errors.append(f"字段 '{field}' 类型错误: {msg}")
                else:
                    friendly_errors.append(f"字段 '{field}' 验证失败: {msg}")

                # 创建可序列化的错误信息（移除不能序列化的对象）
                serializable_error = {
                    "type": error_type,
                    "loc": list(error.get("loc", [])),
                    "msg": msg,
                    "input": str(error.get("input", "")),  # 转换为字符串避免序列化问题
                }
                serializable_errors.append(serializable_error)

            error_message = "请求参数验证失败: " + "; ".join(friendly_errors)
            logger.warning(error_message)

            return create_error_response(message=error_message, data={"validation_errors": serializable_errors})
        except Exception as e:
            logger.error(f"参数验证过程中发生未知错误: {e}")
            logger.error(traceback.format_exc())
            return create_error_response(message=f"参数验证失败: {str(e)}", data={"error": str(e)})

        # 验证请求参数
        if not request.file_keys:
            logger.warning("文件key列表为空")
            return create_error_response(message="文件key列表不能为空", data={"file_keys": request.file_keys})

        # 根据转换类型选择服务
        convert_type = (request.convert_type or "pdf").lower()
        # 将 ppt 转换为 pptx
        if convert_type == "ppt":
            convert_type = "pptx"

        # 如果没有提供 task_key，自动生成一个
        if not request.task_key:
            import uuid
            from datetime import datetime

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            request.task_key = f"auto_task_{timestamp}_{uuid.uuid4().hex[:8]}"

        task_key = request.task_key

        logger.info(
            f"收到文件转换请求: 类型 -> {convert_type.upper()}, "
            f"文件Keys -> {len(request.file_keys)}, "
            f"TaskKey -> {task_key}"
        )

        # 检查任务是否已存在
        existing_task = await task_manager.get_task_result(task_key)
        if existing_task:
            return create_error_response(
                message=f"任务已存在: {task_key}", data={"task_key": task_key, "status": existing_task.status}
            )

        # 创建任务
        await task_manager.create_task(task_key, convert_type)

        # 启动后台转换任务
        asyncio.create_task(_perform_conversion_async(request=request, convert_type=convert_type, task_key=task_key))

        # 立即返回任务已接受的响应
        return create_success_response(
            message=f"{convert_type.upper()}转换任务已提交",
            data={
                "task_key": task_key,
                "status": "pending",
                "convert_type": convert_type,
                "message": "任务已提交，正在处理中...",
            },
        )

    except ValueError as e:
        logger.warning(f"文件转换请求参数错误: {e}")
        logger.warning(f"请求数据: {request_data}")
        return create_error_response(message=f"请求参数错误: {str(e)}", data={"error": str(e)})

    except RuntimeError as e:
        logger.error(f"文件转换运行时错误: {e}")
        logger.error(f"请求数据: {request_data}")
        logger.error(traceback.format_exc())
        return create_error_response(message=f"转换失败: {str(e)}", data={"error": str(e)})

    except Exception as e:
        logger.error(f"文件转换发生未知错误: {e}")
        logger.error(f"请求数据: {request_data}")
        logger.error(traceback.format_exc())

        return create_error_response(message="文件转换失败，请稍后重试", data={"error": str(e)})


@router.get("/converts/{task_key}", response_model=BaseResponse)
async def get_convert_result(task_key: str) -> BaseResponse:
    """
    根据task_key查询转换结果

    Args:
        task_key: 任务标识符

    Returns:
        BaseResponse: 包含转换结果的响应
        - pending状态：只返回基础信息
        - processing状态：返回基础信息 + 转换进度信息
        - completed状态：返回基础信息 + 转换进度信息 + 文件下载信息
        - failed状态：返回基础信息 + 错误信息
    """
    try:
        # 获取任务结果
        task_result = await task_manager.get_task_result(task_key)

        if not task_result:
            return create_error_response(message=f"任务不存在: {task_key}", data={"task_key": task_key})

        # 构建响应数据
        response_data = {
            "task_key": task_result.task_key,
            "status": task_result.status,
            "convert_type": task_result.convert_type,
            "created_at": task_result.created_at,
            "updated_at": task_result.updated_at,
        }

        # 如果任务完成或正在处理，添加进度字段
        if task_result.status in ["completed", "processing"]:
            if task_result.batch_id:
                response_data["batch_id"] = task_result.batch_id
            if task_result.total_files is not None:
                response_data["total_files"] = task_result.total_files
            if task_result.success_count is not None:
                response_data["success_count"] = task_result.success_count
            # 添加转换率相关字段
            if task_result.valid_files_count is not None:
                response_data["valid_files_count"] = task_result.valid_files_count
            if task_result.conversion_rate is not None:
                response_data["conversion_rate"] = task_result.conversion_rate
            # 只有任务完成时才返回files字段
            if task_result.status == "completed" and task_result.files is not None:
                response_data["files"] = task_result.files

        # 添加闲置时间字段（所有状态都返回）
        if task_result.idle_duration is not None:
            response_data["idle_duration"] = task_result.idle_duration

        # 如果任务失败，添加错误信息
        if task_result.status == "failed" and task_result.error_message:
            response_data["error_message"] = task_result.error_message

        return create_success_response(message=f"任务状态: {task_result.status}", data=response_data)

    except Exception as e:
        logger.error(f"查询转换结果失败: {e}")
        return create_error_response(message="查询转换结果失败", data={"task_key": task_key, "error": str(e)})


async def _perform_conversion_async(request: FileConvertRequest, convert_type: str, task_key: str) -> None:
    """
    执行异步转换任务

    Args:
        request: 转换请求
        convert_type: 转换类型
        task_key: 任务标识符
    """
    try:
        # 标记任务开始处理，并设置初始信息
        initial_result = {
            "success_count": 0,
            "valid_files_count": 0,
            "conversion_rate": 0.0,
            # 注意：不设置total_files，让转换服务在分析文件后设置正确的数量
        }
        processing_result = await task_manager.update_task_status(
            task_key, TaskStatus.PROCESSING, result=initial_result
        )
        if not processing_result:
            logger.warning(f"标记任务开始处理失败: {task_key}")

        logger.info(f"开始异步转换任务: {task_key}")

        # 创建 AIGC 元数据参数对象
        aigc_params = AigcMetadataParams(
            user_id=request.user_id, organization_code=request.organization_code, topic_id=request.topic_id
        )

        result: Dict[str, Any]

        # 准备通用参数：file_keys_dict 和 sts_credential_dict
        # 显式校验并转换类型，避免使用 type: ignore
        file_keys_dict = []
        for item in request.file_keys:
            if not isinstance(item, FileKeyItem):
                # 防御性编程：尽管 field_validator 已处理，但此处显式断言类型更安全
                raise TypeError(f"request.file_keys 含非法类型: {type(item)}")
            file_keys_dict.append({"file_key": item.file_key})

        sts_credential_dict = None
        if request.sts_temporary_credential:
            sts_credential_dict = request.sts_temporary_credential.model_dump()

        if convert_type == "pdf":
            # 🖼️ 启用长截图模式，避免页面被分页
            pdf_service = PdfConvertService(enable_full_page=True)

            # **【新增】重置 agent idle 时间 - 任务启动时**
            pdf_service.update_agent_activity("PDF转换任务启动")

            result = await pdf_service.convert_file_keys_to_pdf(
                file_keys=file_keys_dict, task_key=task_key, sts_credential=sts_credential_dict, aigc_params=aigc_params
            )
        elif convert_type == "pptx":
            pptx_service = PptxConvertService()

            # **【新增】重置 agent idle 时间 - 任务启动时**
            pptx_service.update_agent_activity("PPTX转换任务启动")

            result = await pptx_service.convert_file_keys_to_pptx(
                file_keys=file_keys_dict, task_key=task_key, sts_credential=sts_credential_dict, aigc_params=aigc_params
            )
        else:
            error_msg = f"不支持的转换类型: {request.convert_type}"
            fail_result = await task_manager.fail_task(task_key, error_msg)
            if not fail_result:
                logger.error(f"标记任务失败也失败了: {task_key}")
            return

        # 标记任务完成
        complete_result = await task_manager.complete_task(task_key, result)
        if not complete_result:
            logger.warning(f"标记任务完成失败: {task_key}")

        # 记录成功日志
        success_count = result.get("success_count", 0)
        total_files = result.get("total_files") or result.get("total_keys", 0)
        logger.info(f"{convert_type.upper()}转换完成: 任务 {task_key}, 成功 {success_count}/{total_files} 文件")

    except Exception as e:
        # 标记任务失败
        error_msg = f"转换过程中发生错误: {str(e)}"
        fail_result = await task_manager.fail_task(task_key, error_msg)
        if not fail_result:
            logger.error(f"标记任务失败也失败了: {task_key}")
        logger.error(f"异步转换任务失败 {task_key}: {e}")
        logger.error(traceback.format_exc())

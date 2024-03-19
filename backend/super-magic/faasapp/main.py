import os

import uvicorn
from fastapi.staticfiles import StaticFiles

from faasapp.app import app


# 确保静态目录存在
def ensure_static_dirs():
    """确保静态文件目录存在"""
    # 获取项目根目录
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

    # 确保output目录存在
    output_dir = os.path.join(root_dir, "output")
    os.makedirs(output_dir, exist_ok=True)

    return output_dir


if __name__ == "__main__":
    """
    启动FastAPI应用

    使用方法:
    python -m faasapp.main
    """
    # 确保静态目录存在
    output_dir = ensure_static_dirs()

    # 挂载静态文件目录
    app.mount("/static", StaticFiles(directory=output_dir), name="static")

    # 启动服务
    uvicorn.run("faasapp.app:app", host="0.0.0.0", port=8001, reload=True)

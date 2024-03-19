from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware

from faasapp.exceptions import exception_handler
from faasapp.router import router as browser_router

# 创建FastAPI应用实例
app = FastAPI(title="BrowserAPI", description="FastAPI应用，集成浏览器工具和健康检查接口", version="0.1.0")

# 添加 CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有源，也可以指定特定域名，如 ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],  # 允许所有方法
    allow_headers=["*"],  # 允许所有头信息
)

app.add_middleware(exception_handler)

# 注册路由器
app.include_router(browser_router)


@app.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    """
    健康检查接口

    返回:
        dict: 包含状态信息的字典
    """
    return {"status": "healthy"}

@echo off
chcp 65001 >nul
set CONCEPT=%1

if "%CONCEPT%"=="" (
    echo [ERROR] 概念を引数に指定してください。
    exit /b
)

echo [LOG] 「%CONCEPT%」を送信中...
curl -X POST https://i-tya-dictionary.onrender.com/api/generate ^
     -H "Content-Type: application/json" ^
     -d "{\"concept\": \"%CONCEPT%\"}"
echo.
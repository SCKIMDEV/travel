@echo off
rem Travel Diary 로컬 서버 (127.0.0.1:8787 에서만 받음. 외부 공개는 Tailscale Serve 가 담당)
cd /d "%~dp0"
python -m http.server 8787 --bind 127.0.0.1

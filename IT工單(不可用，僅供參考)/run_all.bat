@echo off
chcp 65001 > nul
pushd "%~dp0"
python run_all.py >> run_log.txt 2>&1
popd

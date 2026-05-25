@echo off
setlocal

:: ───────────────────────────────────────────────────────
:: HIVE Study House — Daily Database Backup Script
:: Schedule via Windows Task Scheduler at 11:50 PM daily
:: ───────────────────────────────────────────────────────

:: Source database (relative to script location)
set SCRIPT_DIR=%~dp0
set SOURCE=%SCRIPT_DIR%dev.db

:: Destination folder — update this path to your Google Drive or OneDrive
set BACKUP_DIR=C:\Users\moham\OneDrive\HIVE_Backups

:: Build date string YYYY-MM-DD (compatible with all Windows locales)
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set DATETIME=%%I
set YEAR=%DATETIME:~0,4%
set MONTH=%DATETIME:~4,2%
set DAY=%DATETIME:~6,2%
set DATESTAMP=%YEAR%-%MONTH%-%DAY%

set DEST=%BACKUP_DIR%\db_backup_HIVE_%DATESTAMP%.db

:: Create backup folder if it doesn't exist
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

:: Perform the backup
if exist "%SOURCE%" (
    copy /Y "%SOURCE%" "%DEST%" >nul
    echo [%DATESTAMP%] Backup successful: %DEST%
) else (
    echo [%DATESTAMP%] ERROR: Source database not found at %SOURCE%
    exit /b 1
)

endlocal

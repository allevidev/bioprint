set hostspath=%windir%\System32\drivers\etc\hosts

echo 127.0.0.1 bioprint >> %hostspath%

cd "%~dp0"
cd ../bioprint

C:\Python27\Scripts\easy_install.exe bioprint-latest.egg
pause

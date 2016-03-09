set hostspath=%windir%\System32\drivers\etc\hosts

echo 127.0.0.1 bioprint >> %hostspath%

cd "%~dp0"
cd ../bioprint

C:\Python27\python.exe setup.py install
pause
set hostspath=%windir%\System32\drivers\etc\hosts

echo 127.0.0.1 bioprint >> %hostspath%

cd "%~dp0"
cd ../bioprint

C:\Python27\Scripts\pip.exe install virtualenv
call virtualenv biobots
cd ../bioprint/biobots/Scripts & activate & cd ../../ & easy_install bioprint-bioprint-1.5-py2.7.egg

pause

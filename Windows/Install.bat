set hostspath=%windir%\System32\drivers\etc\hosts

echo 127.0.0.1 bioprint >> %hostspath%

setx path "%path%;C:\Python27;C:\Python27\Scripts"

cd "%~dp0"
cd ../bioprint

C:\Python27\Scripts\pip.exe install virtualenv
call virtualenv -p C:\Python27\python.exe biobots
cd ../bioprint/biobots/Scripts & activate
cd ../../ 
call pip install -r bioprint-requirements.txt
call easy_install bioprint-bioprint-1.4-py2.7.egg

pushd %~dp0
cd ../bioprint
C:\Python27\Scripts\pip.exe install virtualenv
C:\Python27\Scripts\virtualenv.exe -p C:\Python27\python.exe biobots
cd biobots/Scripts & activate  & cd ../../ & pip install -r bioprint-requirements.txt & easy_install bioprint-bioprint-1.5-py2.7.egg & pause

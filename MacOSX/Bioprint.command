#!/bin/sh
sudo kill -9 $(sudo lsof -i tcp:80 | grep LISTEN | awk '{print $2}')
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR
cd ../bioprint
./biobots/activate
sudo python run --iknowwhatimdoing --port 80

read -p "Press Return to Close..."
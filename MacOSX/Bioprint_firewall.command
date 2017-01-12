#!/bin/sh
sudo kill -9 $(sudo lsof -i tcp:9999 | grep LISTEN | awk '{print $2}')
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR
cd ../bioprint
source biobots/bin/activate
sudo python run --iknowwhatimdoing --port 9999

read -p "Press Return to Close..."

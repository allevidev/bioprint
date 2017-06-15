#!/bin/sh
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd /System/Library/Extensions/IOUSBFamily.kext/Contents/PlugIns 
sudo mv AppleUSBFTDI.kext AppleUSBFTDI.disabled 
sudo touch /System/Library/Extensions

xcode-select --install

cd $DIR
cd ../bioprint
sudo pip install virtualenv
virtualenv -p `which python2.7` biobots

source biobots/bin/activate
sudo pip install -r bioprint-requirements.txt
sudo easy_install bioprint-bioprint-1.5-py2.7.egg
sudo -- sh -c "echo '127.0.0.1 bioprint' >> /etc/hosts"
sudo -- sh -c "echo '127.0.0.1:9999 bioprint_firewall' >> /etc/hosts"

read -p "Press Return to reboot..."

sudo reboot

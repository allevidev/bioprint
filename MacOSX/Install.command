#!/bin/sh
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd /System/Library/Extensions/IOUSBFamily.kext/Contents/PlugIns 
sudo mv AppleUSBFTDI.kext AppleUSBFTDI.disabled 
sudo touch /System/Library/Extensions

cd $DIR
cd ../bioprint
sudo easy_install bioprint.egg
sudo -- sh -c "echo '127.0.0.1 bioprint' >> /etc/hosts"
sudo -- sh -c "echo '127.0.0.1:9999 bioprint_firewall' >> /etc/hosts"
read -p "Press Return to reboot..."



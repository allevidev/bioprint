#!/usr/bin/env python
import sys
from bioprint.daemon import Daemon
from bioprint.server import Server

#~~ version

from ._version import get_versions
__version__ = get_versions()['version']
del get_versions

#~~ main class

class Main(Daemon):
	def __init__(self, pidfile, configfile, basedir, host, port, debug, allowRoot, logConf):
		Daemon.__init__(self, pidfile)

		self._configfile = configfile
		self._basedir = basedir
		self._host = host
		self._port = port
		self._debug = debug
		self._allowRoot = allowRoot
		self._logConf = logConf

	def run(self):
		bioprint = Server(self._configfile, self._basedir, self._host, self._port, self._debug, self._allowRoot)
		bioprint.run()

def main():
	import argparse

	parser = argparse.ArgumentParser(prog="run")

	parser.add_argument("-v", "--version", action="store_true", dest="version",
						help="Output bioprint's version and exit")

	parser.add_argument("-d", "--debug", action="store_true", dest="debug",
						help="Enable debug mode")

	parser.add_argument("--host", action="store", type=str, dest="host",
						help="Specify the host on which to bind the server")
	parser.add_argument("--port", action="store", type=int, dest="port",
						help="Specify the port on which to bind the server")

	parser.add_argument("-c", "--config", action="store", dest="config",
						help="Specify the config file to use. bioprint needs to have write access for the settings dialog to work. Defaults to ~/.bioprint/config.yaml")
	parser.add_argument("-b", "--basedir", action="store", dest="basedir",
						help="Specify the basedir to use for uploads, timelapses etc. bioprint needs to have write access. Defaults to ~/.bioprint")
	parser.add_argument("--logging", action="store", dest="logConf",
						help="Specify the config file to use for configuring logging. Defaults to ~/.bioprint/logging.yaml")

	parser.add_argument("--daemon", action="store", type=str, choices=["start", "stop", "restart"],
						help="Daemonize/control daemonized bioprint instance (only supported under Linux right now)")
	parser.add_argument("--pid", action="store", type=str, dest="pidfile", default="/tmp/bioprint.pid",
						help="Pidfile to use for daemonizing, defaults to /tmp/bioprint.pid")

	parser.add_argument("--iknowwhatimdoing", action="store_true", dest="allowRoot",
						help="Allow bioprint to run as user root")

	args = parser.parse_args()

	if args.version:
		print "bioprint version %s" % __version__
		print "BioPrint verion %s" % 1.5
		sys.exit(0)

	if args.daemon:
		if sys.platform == "darwin" or sys.platform == "win32":
			print >> sys.stderr, "Sorry, daemon mode is only supported under Linux right now"
			sys.exit(2)

		daemon = Main(args.pidfile, args.config, args.basedir, args.host, args.port, args.debug, args.allowRoot, args.logConf)
		if "start" == args.daemon:
			daemon.start()
		elif "stop" == args.daemon:
			daemon.stop()
		elif "restart" == args.daemon:
			daemon.restart()
	else:
		bioprint = Server(args.config, args.basedir, args.host, args.port, args.debug, args.allowRoot, args.logConf)
		bioprint.run()

if __name__ == "__main__":
	main()

# coding=utf-8
from __future__ import absolute_import


import bioprint.plugin


class BioPrint(bioprint.plugin.StartupPlugin,
                bioprint.plugin.TemplatePlugin,
                bioprint.plugin.AssetPlugin):
    def on_after_startup(self):
        self._logger.info("BioPrint!")

    def get_assets(self):
        return dict(
            js=["js/bioprint.js"],
            css=["css/bioprint.css"]
            )

__plugin_name__ = "BioPrint"
__plugin_implementation__ = BioPrint()
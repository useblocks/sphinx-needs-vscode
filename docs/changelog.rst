Changelog
=========

0.3.2
-----

Under development

* Support for windows.

0.3.1
-----

Released: 04.03.2024

* Fixed directive snippet random id generation. (`#33 <https://github.com/useblocks/sphinx-needs-vscode/issues/33>`_)

0.3.0
-----

Released: 21.07.2023

* Added setting :ref:`multiDocs` to support multiple docs inside one workspace, see :ref:`advanced`.
* Added explorer :ref:`currView` for sphinx-needs objects of current active editor.

0.2.1
-----

Released: 16.03.2023

* Support goto definition for nested needs.

0.2.0
-----

Released: 10.03.2023

* Updated homepage for extension
* Adapted extension ``activationEvents`` to workspace contains ``conf.py``.
* Added setting :ref:`activateFiles` to configure supported files for language feature activation.
* Added feature :ref:`find_references`.
* Added :ref:`sphinxNeedsExplorer` of Sphinx-Needs needs objects.
* Added setting :ref:`explorerOptions` to configure displayed need options at :ref:`sphinxNeedsExplorer`.
* Added setting :ref:`explorerHoverOptioons` to configure displayed need options when hover over need ID 
  at :ref:`sphinxNeedsExplorer`.
* Added :ref:`sphinxNeedsViews` container on activity bar.
* Added buttons, e.g. open NeedsJson, open Settings, and goto defintion, to improve :ref:`sphinxNeedsExplorer`.
* Added :ref:`helpView` to display useful links about Sphinx-Needs and Sphinx-Needs-VsCode.

0.1.1
-----

Released: 21.12.2022

* Fixed Goto definition not working for multiple need ID same line issue
* Added icon for extension

0.1.0
-----

Released: 20.12.2022

* Added caching of external resource like fonts.
* Fixed issue with docs theme fetching resources from googleapi.com.
* Added instructions on how to install and debug the extension.
* Updated the documentation theme.
* Initial **Sphinx-Needs-VSCode extension**.

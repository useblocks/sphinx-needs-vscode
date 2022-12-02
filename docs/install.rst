.. _install:

Installation
============

.. note:: 
  
    The **Sphinx-Needs-VSCode extension** is still under development and is not available
    on the `Visual Studio Code Marketplace <https://marketplace.visualstudio.com/vscode>`_

Install extension from ``.VSIX`` file
-------------------------------------

- Download the :download:`Sphinx-Needs-VSCode </sphinx-needs-vscode-0.1.0.zip>` extension ``.vsix`` file.

- Install the ``sphinx-needs-vscode-*.*.*.vsix`` file by running the following command:

  .. code-block:: bash

      code --install-extension [path-to-sphinx-needs-vscode-*.*.*.vsix]

- or you can install the ``sphinx-needs-vscode-*.*.*.vsix`` file via the |extension_icon| menu
  then click on the "..." button at the top right and "Install from VSIX".

- Restart VsCode after installation.

- Configure the :ref:`needsJson <needsJsonPath>` and :ref:`srcDir <srcDir>` workspace settings for the extension,
  to specify the *needs JSON path* and *source directory* of your Sphinx-Needs project.

- or you can open ``.vscode/settings.json``, and specify the path:

  .. image:: https://raw.githubusercontent.com/useblocks/sphinx-needs-vscode/main/docs/_images/settings.gif
     :align: center

- Open any **.rst** file to activate the extension.


.. |extension_icon| image:: /_images/extension_icon.png
   :align: middle
   :width: 30px
   :height: 30px

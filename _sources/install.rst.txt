.. _install:

Installation
============

Install extension from VsCode Marketplace
-----------------------------------------

Install extension `Sphinx-Needs <https://marketplace.visualstudio.com/items?itemName=useblocks.sphinx-needs-vscode>`_ from VsCode Marketplace.

- Open VsCode
- Open view of Extension (Ctrl+Shift+X)
- Search Extension ``Sphinx-Needs``, check if publisher identifier matches: ``useblocks.sphinx-needs-vscode``
- Install

Install extension from ``.VSIX`` file
-------------------------------------

- Clone the source repository

  .. code-block:: bash

      git clone https://github.com/useblocks/sphinx-needs-vscode.git
      cd sphinx-needs-vscode
- Build the **Sphinx-Needs-VSCode** extension ``.vsix`` file locally using the command:

  .. code-block:: bash

      npm install vsce
      vsce package --baseContentUrl https://github.com/useblocks/sphinx-needs-vscode --baseImagesUrl https://github.com/useblocks/sphinx-needs-vscode
- Install the ``sphinx-needs-vscode-*.*.*.vsix`` file:
    - Using your terminal, run the command below

      .. code-block:: bash

          code --install-extension [path-to-sphinx-needs-vscode-*.*.*.vsix]

    - or Using the |extension_icon| menu, click on the **"..."** button at the top right and select *Install from VSIX*.

- Restart VsCode after installation.
- Configure the :ref:`needsJson <needsJsonPath>` and :ref:`srcDir <srcDir>` workspace settings for the extension,
  to specify the *needs JSON path* and *source directory* of your Sphinx-Needs project.
- or you can open ``.vscode/settings.json``, and specify the path:

  .. image:: /_images/settings_json.png
     :align: center
     :alt: Settings.json file
- Open any **.rst** file to activate the extension.


.. |extension_icon| image:: /_images/extension_icon.png
   :align: middle
   :width: 30px
   :height: 30px
   :alt: VSCode Extension Menu Icon

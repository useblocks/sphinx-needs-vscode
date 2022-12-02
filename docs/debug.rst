.. _debug:

Debugging
=========

Prerequisites
-------------

Here are the required prerequisites for installing and compiling the extension from source:

- NodeJS
- NPM

Check if the above packages are installed.

.. code-block:: bash

    node -v # Check installed NodeJS version
    npm -v # Check installed NPM version

You can check :ref:`How to install NodeJS and NPM <install_node_npm>` from this dropdown.

.. dropdown:: How to install NodeJS and NPM
   :animate: fade-in-slide-down
   :name: install_node_npm

   **Install NodeJS**

   .. md-tab-set::
       :class: nodejs-tab-set
       :name: ref_nodejs_install

       .. md-tab-item:: Linux

           Install NodeJS ``>=14.0.0`` from ``.tar.xz``

           - Download latest version of NodeJS from https://nodejs.org/en/
           - Run the command below to install NodeJS. Change the file name with the NodeJS file downloaded ``node-v18.12.1-linux-x64.tar.xz``.

             .. code-block:: bash

                 sudo tar -C /usr/local --strip-components 1 -xf node-v18.12.1-linux-x64.tar.xz

           - Check if NodeJS is installed: ``node -v``. The version must be ``>=14.0.0``.

       .. md-tab-item:: Windows OS

           - Download latest version of NodeJS for Windows from https://nodejs.org/en/download/
           - Install package by double clicking on the downloaded ``.msi`` file.

              You can read more about how to install NodeJS `here <https://radixweb.com/blog/installing-npm-and-nodejs-on-windows-and-mac#windows>`_

   **Install NPM**

   .. md-tab-set::
      :class: npm-tab-set
      :name: ref_npm_install

      .. md-tab-item:: Linux

          **Using curl**

          .. code-block:: bash

              curl -0 -L https://npmjs.org/install.sh | sudo sh

          **Using apt package**

          .. code-block:: bash

              sudo apt install npm

      .. md-tab-item:: Windows OS

          You can read more about how to install NPM `here <https://radixweb.com/blog/installing-npm-and-nodejs-on-windows-and-mac#windows>`_

Clone the source repository
---------------------------

.. code-block:: bash

    git clone https://github.com/useblocks/sphinx-needs-vscode.git
    cd sphinx-needs-vscode

Install and Compile Sphinx-Needs-VSCode extension
-------------------------------------------------

- Run ``npm install`` to install extension.
- Run ``npm run compile`` to compile extension.
- Run ``code .`` to open VSCode window.

Debugging the Sphinx-Needs-VSCode extension
-------------------------------------------

Inside VScode, goto the debugger menu and select the **"Client + Server"** configuration.

.. image:: /_images/client_server_launch.png
   :align: center

The **"Client + Server"** launch configuration compiles the extension then opens it inside a new window so you can test the extension.


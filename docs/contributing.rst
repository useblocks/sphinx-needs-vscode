.. _contribute:

Contributing
============

Want to contribute to this project? Welcome to the community!

Report found issues
-------------------

Before start coding, if you find some issues, please open a issue first, wait for maintainer to response.

Developing
----------

Setup
~~~~~

* Make sure `node <https://nodejs.org/en/>`_ is installed in your system.

* Check out repository, install and compile, open VS Code

  .. code-block:: bash
 
      git clone https://github.com/useblocks/sphinx-needs-vscode.git
      cd sphinx-needs-vscode
      make init
      code . 

Run
~~~

To run this extension, press (Ctrl+Shift+D) to open Run and Debug view, select ``Launch client`` or ``Client + Server``, press (F5).

It will open a new VS Code window with name of ``Extension Development Host``. The default opened folder is ``client/testData``, then
you can open any rst files there to try out your changes.


Test
~~~~

You can write E2E tests at ``client/src/test``, and run ``npm run test`` or ``make test``. To debug your tests, set breakpoints in your
test case, then open Run and Debug view, select ``Language Server E2E Test``, press (F5).


Lint
~~~~

Run ``npm run lint`` or ``make lint`` to check lint errors in your code.

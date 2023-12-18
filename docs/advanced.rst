.. _advanced:

Advanced
========

Multi Docs Support
------------------

To support multiple docs inside one workspace, config setting of :ref:`multiDocs`, all the features
and tree views for each specified docs will also be available.

Example:

.. image:: /_images/multiDocs.gif
   :align: center


Custom Code Completion
----------------------

If the provided *needs*-snippets are not sufficient, custom snippets can be provided within the
`.vscode/settings.json` file.

This also includes custom snippets activation pattern, which enables custom snippets to be
written for other file formats (e.g., markdown) as well.

Example:

.. code-block:: json
   
   {
      "sphinx-needs.ideSnippets": [
         {
               "needsType": "req",
               "snippetStart": ":::",
               "snippet": "{req} ${1:Title}\n:id: ${2:NeedID}\n\n${3:Content}"
         }
      ]
   }

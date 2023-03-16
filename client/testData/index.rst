Test-Env project
================

Just a test project for tests (tataaaa!).


Needs
-----


.. req:: First requirement
   :id: REQ_1
   :status: open
   :links: SPEC_1,
         REQ_3, REQ_2
   :tests: REQ_2

   Requirement content of REQ_1.


.. spec:: First specification
   :id: SPEC_1
   :status: open
   :links: REQ_3
   :tests: REQ_2

   Specification content of SPEC_1.

.. spec:: Dummy Title
   :id: SPEC_3
   :status: open

   Content of SPEC_3.

:need:`REQ_1`

REQ_2, SPEC_1, REQ_10, REQ_25

:need:`->`

:need:`->req>`

:need:`->req>index.rst>`

:need:`->req>mySubFolder/`

.. toctree::
   :maxdepth: 2

   mySubFolder/sub.rst

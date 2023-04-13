SubFolder Document
==================

.. req:: Second requirement of doc1
   :id: REQ_2
   :status: open

   Requirement content of REQ_2.

.. req:: Third requirement of doc1
   :id: REQ_3
   :status: open

   Requirement content of REQ_3.

.. req:: Fourth requirementof doc1
   :id: REQ_4
   :status: open
   :checked_by: REQ_2
   :triggered-by: REQ_3

   Requirement content of REQ_4.

   .. req:: Child requirement of doc1
      :id: REQ_10
      :status: open

      Requirement content of REQ_10.

      .. req:: Grandchild requirement of doc1
         :id: REQ_20
         :status: open

         Requirement content of REQ_20.      

   .. req:: Child sibling requirement of doc1
      :id: REQ_15
      :status: open

      Requirement content of REQ_15.

      .. req:: Grand child sibling requirement of doc1
         :id: REQ_25
         :status: open

         Requirement content of REQ_25.

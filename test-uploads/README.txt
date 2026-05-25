ZENTRA FLOW — TEST UPLOAD FILES
================================
Today's date assumed: 12 May 2026

=== INVOICE / AR AGEING IMPORTS ===

1. ar-ageing-import.csv  ← START HERE (first import)
   - 25 invoices across all overdue buckets
   - Current (not yet due), 1-30d, 31-60d, 61-90d, 90+ overdue
   - Mix of statuses: overdue, current, disputed, promised
   - Some with emails, some without (tests warnings)
   - One 90+ day invoice (Clearwater, Sep 2025 — 209 days overdue)
   - Realistic UK company names and invoice numbers

2. ar-ageing-reimport.csv  ← UPLOAD SECOND (tests re-import diff)
   Changes vs first import to test detection of:
   ✓ Ashford Digital INV-0841 → now PAID (was overdue)
   ✓ Foxglove Events INV-0044 → now PAID (was overdue)
   ✓ Summit Property INV-0088 → amount changed (£18,500 → £14,000)
   ✓ Ashford Digital INV-0178 → promise missed (was "promised", now "overdue")
   ✓ Castlegate INV-0122 → now overdue (was current)
   ✓ 2 new invoices added (Castlegate INV-0199, Riverview INV-0204)

=== BANK STATEMENT IMPORTS ===

3. bank-monzo.csv
   Format: Monzo business export
   Headers: Transaction ID, Date, Time, Type, Name, Notes and #tags, Amount, Currency
   20 transactions — mix of customer payments received + business expenses

4. bank-barclays.csv
   Format: Barclays business export
   Headers: Number, Date, Account, Amount, Subcategory, Memo
   20 transactions

5. bank-hsbc.csv
   Format: HSBC business export (SPLIT debit/credit columns)
   Headers: Date, Description, Reference, Debit, Credit, Balance
   21 transactions — tests the debit/credit split logic

6. bank-natwest.csv
   Format: NatWest business export
   Headers: Date, Type, Description, Value, Balance, Account Name, Account Number, Sort Code
   19 transactions

7. bank-lloyds.csv
   Format: Lloyds business export
   Headers: Transaction Date, Transaction Type, Sort Code, Account Number, Transaction Description, Debit Amount, Credit Amount, Balance
   20 transactions — tests debit/credit split

8. bank-starling.csv
   Format: Starling business export
   Headers: Date, Counter Party, Reference, Type, Amount (GBP), Balance (GBP), Spending Category
   20 transactions

=== WHAT TO TEST ===

Invoice import:
- Upload ar-ageing-import.csv → check column mapping auto-detects fields
- Verify invoices land in correct ageing buckets
- Check disputed + promised invoices show correct status
- Upload ar-ageing-reimport.csv → check diff shows paid/changed/new invoices

Bank statement import:
- Upload each bank file → check correct bank is auto-detected
- HSBC + Lloyds specifically test debit/credit split column logic
- Check transaction amounts and dates parse correctly

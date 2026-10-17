import json
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.utils import timezone

from .models import Item, Organization


class Base(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user('tester', password='pw-12345')
        self.client.force_login(self.user)
        org = Organization.get()
        org.state, org.opening_cash = 'Kerala', Decimal('10000.00')
        org.save()
        self.today = timezone.localdate().isoformat()

    def post(self, path, data=None):
        return self.client.post('/api/' + path, data=json.dumps(data or {}), content_type='application/json')

    def put(self, path, data):
        return self.client.put('/api/' + path, data=json.dumps(data), content_type='application/json')

    def customer(self, **kw):
        d = {'name': 'Acme Traders', 'state': 'Kerala'}
        d.update(kw)
        r = self.post('customers/', d)
        self.assertEqual(r.status_code, 201, r.content)
        return r.json()

    def invoice(self, cust, lines=None, **kw):
        d = {'customer': cust['id'], 'date': self.today,
             'lines': lines or [{'description': 'Dev', 'quantity': '2', 'rate': '1000', 'discount_percent': '10', 'gst_rate': '18'}]}
        d.update(kw)
        r = self.post('invoices/', d)
        self.assertEqual(r.status_code, 201, r.content)
        return r.json()

    def send(self, inv):
        return self.post(f"invoices/{inv['id']}/send/")

    def receive(self, cust, amount, allocations):
        return self.post('payments-received/', {'customer': cust['id'], 'date': self.today, 'amount': amount, 'allocations': allocations})


class AuthAndValidation(Base):
    def test_requires_login(self):
        r = Client().get('/api/customers/')
        self.assertEqual(r.status_code, 401)

    def test_customer_validation(self):
        r = self.post('customers/', {'name': '', 'gstin': 'BAD', 'email': 'nope'})
        self.assertEqual(r.status_code, 400)
        errs = r.json()['errors']
        self.assertIn('name', errs)
        self.assertIn('gstin', errs)
        self.assertIn('email', errs)

    def test_duplicate_sku_rejected(self):
        self.assertEqual(self.post('items/', {'name': 'A', 'sku': 'x1'}).status_code, 201)
        r = self.post('items/', {'name': 'B', 'sku': 'X1'})
        self.assertEqual(r.status_code, 400)
        self.assertIn('sku', r.json()['errors'])

    def test_csv_export(self):
        self.customer(name='Export Me')
        r = self.client.get('/api/customers/?export=csv')
        self.assertEqual(r.status_code, 200)
        self.assertIn('text/csv', r['Content-Type'])
        self.assertIn('Export Me', r.content.decode())

    def test_delete_customer_with_invoice_blocked(self):
        c = self.customer()
        self.invoice(c)
        self.assertEqual(self.client.delete(f"/api/customers/{c['id']}/").status_code, 409)


class Gst(Base):
    def test_intra_state_splits_cgst_sgst(self):
        inv = self.invoice(self.customer())
        self.assertEqual(Decimal(inv['subtotal']), Decimal('1800.00'))
        self.assertEqual(Decimal(inv['cgst']), Decimal('162.00'))
        self.assertEqual(Decimal(inv['sgst']), Decimal('162.00'))
        self.assertEqual(Decimal(inv['igst']), Decimal('0'))
        self.assertEqual(Decimal(inv['total']), Decimal('2124.00'))

    def test_inter_state_uses_igst(self):
        inv = self.invoice(self.customer(state='Karnataka'))
        self.assertEqual(inv['place_of_supply'], 'Karnataka')
        self.assertEqual(Decimal(inv['igst']), Decimal('324.00'))
        self.assertEqual(Decimal(inv['cgst']), Decimal('0'))
        self.assertEqual(Decimal(inv['total']), Decimal('2124.00'))

    def test_exempt_line_gets_no_tax(self):
        inv = self.invoice(self.customer(), lines=[{'description': 'Exempt', 'quantity': '1', 'rate': '500', 'gst_rate': '0'}])
        self.assertEqual(Decimal(inv['total']), Decimal('500.00'))

    def test_invalid_slab_and_quantity_rejected(self):
        c = self.customer()
        r = self.post('invoices/', {'customer': c['id'], 'date': self.today, 'lines': [{'description': 'x', 'quantity': '0', 'rate': '1', 'gst_rate': '7'}]})
        self.assertEqual(r.status_code, 400)
        self.assertIn('lines', r.json()['errors'])


class Payments(Base):
    def test_allocation_flow(self):
        c = self.customer()
        inv = self.invoice(c)
        self.assertEqual(self.send(inv).status_code, 200)
        r = self.receive(c, '1000', [{'invoice': inv['id'], 'amount': '1000'}])
        self.assertEqual(r.status_code, 201, r.content)
        d = self.client.get(f"/api/invoices/{inv['id']}/").json()
        self.assertEqual(d['status'], 'Partially Paid')
        self.assertEqual(Decimal(d['balance']), Decimal('1124.00'))
        over = self.receive(c, '5000', [{'invoice': inv['id'], 'amount': '2000'}])
        self.assertEqual(over.status_code, 400)
        ok = self.receive(c, '1124', [{'invoice': inv['id'], 'amount': '1124'}])
        self.assertEqual(ok.status_code, 201)
        d = self.client.get(f"/api/invoices/{inv['id']}/").json()
        self.assertEqual(d['status'], 'Paid')
        self.assertEqual(Decimal(d['balance']), Decimal('0'))

    def test_cannot_apply_more_than_payment_amount(self):
        c = self.customer()
        inv = self.invoice(c)
        self.send(inv)
        self.assertEqual(self.receive(c, '100', [{'invoice': inv['id'], 'amount': '500'}]).status_code, 400)

    def test_cannot_pay_draft_or_other_customers_invoice(self):
        c, other = self.customer(), self.customer(name='Other Co')
        inv = self.invoice(c)
        self.assertEqual(self.receive(c, '100', [{'invoice': inv['id'], 'amount': '100'}]).status_code, 400)  # draft
        self.send(inv)
        self.assertEqual(self.receive(other, '100', [{'invoice': inv['id'], 'amount': '100'}]).status_code, 400)

    def test_deleting_payment_restores_balance(self):
        c = self.customer()
        inv = self.invoice(c)
        self.send(inv)
        pay = self.receive(c, '2124', [{'invoice': inv['id'], 'amount': '2124'}]).json()
        self.assertEqual(self.client.delete(f"/api/payments-received/{pay['id']}/").status_code, 204)
        d = self.client.get(f"/api/invoices/{inv['id']}/").json()
        self.assertEqual(Decimal(d['balance']), Decimal('2124.00'))

    def test_void_blocked_when_paid_and_edit_blocked_when_sent(self):
        c = self.customer()
        inv = self.invoice(c)
        self.send(inv)
        self.assertEqual(self.put(f"invoices/{inv['id']}/", {'customer': c['id'], 'date': self.today, 'lines': [{'description': 'x', 'quantity': '1', 'rate': '1', 'gst_rate': '0'}]}).status_code, 409)
        self.receive(c, '100', [{'invoice': inv['id'], 'amount': '100'}])
        self.assertEqual(self.post(f"invoices/{inv['id']}/void/").status_code, 409)

    def test_vendor_payment_updates_bill(self):
        v = self.post('vendors/', {'name': 'Supplier', 'state': 'Kerala'}).json()
        b = self.post('bills/', {'vendor': v['id'], 'date': self.today, 'lines': [{'description': 'Hosting', 'quantity': '1', 'rate': '1000', 'gst_rate': '18'}]}).json()
        self.assertEqual(self.post(f"bills/{b['id']}/approve/").status_code, 200)
        r = self.post('payments-made/', {'vendor': v['id'], 'date': self.today, 'amount': '1180', 'allocations': [{'bill': b['id'], 'amount': '1180'}]})
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(self.client.get(f"/api/bills/{b['id']}/").json()['status'], 'Paid')


class Stock(Base):
    def item(self, stock='5'):
        r = self.post('items/', {'name': 'Laptop', 'sku': 'GD-1', 'item_type': 'goods', 'track_inventory': True,
                                 'selling_price': '50000', 'purchase_price': '40000', 'gst_rate': '18', 'opening_stock': stock})
        self.assertEqual(r.status_code, 201, r.content)
        return r.json()

    def test_sale_reduces_stock_and_void_restores(self):
        it, c = self.item(), self.customer()
        line = lambda q: [{'item': it['id'], 'quantity': q, 'rate': '50000', 'gst_rate': '18'}]
        big = self.invoice(c, lines=line('6'))
        r = self.send(big)
        self.assertEqual(r.status_code, 400)
        self.assertIn('Insufficient stock', r.json()['message'])
        self.assertEqual(Item.objects.get(pk=it['id']).stock, Decimal('5'))
        ok = self.invoice(c, lines=line('3'))
        self.assertEqual(self.send(ok).status_code, 200)
        self.assertEqual(Item.objects.get(pk=it['id']).stock, Decimal('2'))
        self.assertEqual(self.post(f"invoices/{ok['id']}/void/").status_code, 200)
        self.assertEqual(Item.objects.get(pk=it['id']).stock, Decimal('5'))

    def test_draft_does_not_change_stock(self):
        it, c = self.item(), self.customer()
        self.invoice(c, lines=[{'item': it['id'], 'quantity': '2', 'rate': '1', 'gst_rate': '18'}])
        self.assertEqual(Item.objects.get(pk=it['id']).stock, Decimal('5'))

    def test_adjustment_updates_stock_and_logs_movement(self):
        it = self.item()
        r = self.post('stock-adjustments/', {'item': it['id'], 'date': self.today, 'new_quantity': '8', 'reason': 'Stock recount'})
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(Item.objects.get(pk=it['id']).stock, Decimal('8'))
        mv = self.client.get('/api/stock-movements/?kind=adjustment').json()
        self.assertEqual(mv['count'], 1)
        self.assertEqual(Decimal(mv['results'][0]['change']), Decimal('3'))
        same = self.post('stock-adjustments/', {'item': it['id'], 'date': self.today, 'new_quantity': '8', 'reason': 'Other'})
        self.assertEqual(same.status_code, 400)

    def test_bill_approval_adds_stock(self):
        it = self.item()
        v = self.post('vendors/', {'name': 'Supplier'}).json()
        b = self.post('bills/', {'vendor': v['id'], 'date': self.today, 'lines': [{'item': it['id'], 'quantity': '4', 'rate': '40000', 'gst_rate': '18'}]}).json()
        self.post(f"bills/{b['id']}/approve/")
        self.assertEqual(Item.objects.get(pk=it['id']).stock, Decimal('9'))


class Dashboard(Base):
    def test_figures_derive_from_records(self):
        c = self.customer()
        inv = self.invoice(c)
        self.send(inv)
        self.receive(c, '1000', [{'invoice': inv['id'], 'amount': '1000'}])
        d = self.client.get('/api/dashboard/').json()
        k = d['kpis']
        self.assertEqual(Decimal(k['revenue']['value']), Decimal('1800.00'))
        self.assertEqual(Decimal(k['receivables']['value']), Decimal('1124.00'))
        self.assertEqual(Decimal(k['cash']['value']), Decimal('11000.00'))
        self.assertEqual(k['outstanding_invoices']['value'], 1)
        self.assertEqual(Decimal(k['gst_payable']['value']), Decimal('324.00'))

    def test_empty_database_is_valid(self):
        r = self.client.get('/api/dashboard/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Decimal(r.json()['kpis']['revenue']['value']), Decimal('0'))

    def test_bad_range_rejected(self):
        self.assertEqual(self.client.get('/api/dashboard/?start=2026-05-01&end=2026-04-01').status_code, 400)
        self.assertEqual(self.client.get('/api/dashboard/?start=abc').status_code, 400)


class EnterpriseFeaturesTest(Base):
    def test_double_entry_and_trial_balance(self):
        c = self.customer()
        inv = self.invoice(c)
        self.send(inv)
        tb_resp = self.client.get('/api/reports/trial-balance/')
        self.assertEqual(tb_resp.status_code, 200)
        tb = tb_resp.json()
        self.assertTrue(tb['is_balanced'])
        self.assertEqual(Decimal(str(tb['total_debit'])), Decimal(str(tb['total_credit'])))

    def test_gst_filing_reports(self):
        c = self.customer(gstin='32AABCT1234F1Z5')
        inv = self.invoice(c)
        self.send(inv)
        g1_resp = self.client.get('/api/reports/gstr1/')
        self.assertEqual(g1_resp.status_code, 200)
        g1 = g1_resp.json()
        self.assertGreaterEqual(len(g1['b2b']), 1)
        g3_resp = self.client.get('/api/reports/gstr3b/')
        self.assertEqual(g3_resp.status_code, 200)

    def test_documents_soft_delete_and_trash_recovery(self):
        # Create document
        r = self.post('documents/', {'title': 'AWS Receipt', 'category': 'receipt', 'filename': 'aws_invoice.pdf', 'file_data': 'test'})
        self.assertEqual(r.status_code, 201)
        doc_id = r.json()['id']
        # Verify OCR processed
        self.assertEqual(r.json()['ocr_status'], 'processed')

        # Soft delete
        del_r = self.client.delete(f'/api/documents/{doc_id}/')
        self.assertEqual(del_r.status_code, 204)

        # Check not in active list
        active_docs = self.client.get('/api/documents/?trash=0').json()
        self.assertFalse(any(d['id'] == doc_id for d in active_docs['results']))

        # Check in trash list (/#/documents/trash)
        trash_docs = self.client.get('/api/documents/?trash=1').json()
        self.assertTrue(any(d['id'] == doc_id for d in trash_docs['results']))

        # Restore from trash
        rest_r = self.client.post(f'/api/documents/{doc_id}/restore/')
        self.assertEqual(rest_r.status_code, 200)

        # Verify back in active
        active_again = self.client.get('/api/documents/?trash=0').json()
        self.assertTrue(any(d['id'] == doc_id for d in active_again['results']))

    def test_banking_and_match_suggestions(self):
        ba = self.post('bank-accounts/', {'name': 'HDFC Primary Current', 'bank_name': 'HDFC Bank', 'account_number': '50200012345678', 'current_balance': '50000'}).json()
        imp = self.client.post('/api/banking/statement-import/', data=json.dumps({'bank_account': ba['id']}), content_type='application/json')
        self.assertEqual(imp.status_code, 200)
        txns = self.client.get(f'/api/bank-transactions/?bank_account={ba["id"]}').json()
        self.assertGreaterEqual(txns['count'], 1)
        txn_id = txns['results'][0]['id']
        sugg = self.client.get(f'/api/banking/match-suggestions/{txn_id}/')
        self.assertEqual(sugg.status_code, 200)

    def test_transaction_locking(self):
        # Lock transactions prior to today + 5 days
        lock_date = '2026-10-25'
        lock_resp = self.client.post('/api/locking/', data=json.dumps({'lock_date': lock_date, 'reason': 'Audit Closed'}), content_type='application/json')
        self.assertEqual(lock_resp.status_code, 200)

        # Attempt to create an invoice in locked period
        c = self.customer()
        inv_locked = self.client.post('/api/invoices/', data=json.dumps({'customer': c['id'], 'date': '2026-10-20', 'lines': [{'description': 'Test', 'quantity': 1, 'rate': 100}]}), content_type='application/json')
        self.assertEqual(inv_locked.status_code, 403)

        # Unlock
        self.client.post('/api/locking/', data=json.dumps({'lock_date': None}), content_type='application/json')

    def test_zia_ai_and_mcp_protocol(self):
        # Zia natural language query
        zia_resp = self.client.post('/api/ai/query/', data=json.dumps({'query': 'What is our revenue this month?'}), content_type='application/json')
        self.assertEqual(zia_resp.status_code, 200)
        self.assertIn('revenue', zia_resp.json()['answer'].lower())

        # MCP JSON-RPC protocol
        mcp_init = self.client.post('/api/mcp/', data=json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'initialize'}), content_type='application/json')
        self.assertEqual(mcp_init.status_code, 200)
        self.assertIn('convosis-books-mcp', mcp_init.json()['result']['serverInfo']['name'])

        mcp_tools = self.client.post('/api/mcp/', data=json.dumps({'jsonrpc': '2.0', 'id': 2, 'method': 'tools/list'}), content_type='application/json')
        self.assertEqual(mcp_tools.status_code, 200)
        self.assertGreaterEqual(len(mcp_tools.json()['result']['tools']), 3)

    def test_health_check_resilience(self):
        resp = self.client.get('/api/health/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['status'], 'healthy')
        self.assertIn('latency_ms', resp.json()['database'])

    def test_fingpt_doubt_clearance(self):
        # 1. Debit vs Credit doubt
        r1 = self.client.post('/api/ai/doubt-clearance/', data=json.dumps({'query': 'Clear my doubt: debit vs credit rules'}), content_type='application/json')
        self.assertEqual(r1.status_code, 200)
        d1 = r1.json()
        self.assertIn('doubt_topic', d1)
        self.assertIn('debit', d1['answer'].lower())
        self.assertTrue(len(d1['key_takeaways']) >= 2)

        # 2. GST ITC Section 16 doubt
        r2 = self.client.post('/api/ai/doubt-clearance/', data=json.dumps({'query': 'How do I claim GST input tax credit itc under section 16?'}), content_type='application/json')
        self.assertEqual(r2.status_code, 200)
        d2 = r2.json()
        self.assertIn('section 16', d2['answer'].lower())

        # 3. SOC2 & GDPR Security compliance doubt
        r3 = self.client.post('/api/ai/doubt-clearance/', data=json.dumps({'query': 'What are our SOC2 Type II and GDPR compliance controls?'}), content_type='application/json')
        self.assertEqual(r3.status_code, 200)
        d3 = r3.json()
        self.assertIn('soc 2', d3['answer'].lower())

    def test_enterprise_security_compliance(self):
        # Summary
        r = self.client.get('/api/security/compliance-summary/')
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn('soc2', data)
        self.assertIn('mfa', data)
        self.assertIn('gdpr', data)
        self.assertEqual(data['soc2']['compliance_score'], 100)

        # MFA Toggle
        r_mfa = self.client.post('/api/security/mfa-toggle/')
        self.assertEqual(r_mfa.status_code, 200)
        self.assertIn('mfa_enabled', r_mfa.json())

        # GDPR Export
        r_gdpr = self.client.post('/api/security/gdpr-export/')
        self.assertEqual(r_gdpr.status_code, 200)
        self.assertIn('export_metadata', r_gdpr.json())
        self.assertIn('GDPR', r_gdpr.json()['export_metadata']['standard'])


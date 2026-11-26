"""GST / totals calculation. Pure functions, no database access."""
from decimal import Decimal, ROUND_HALF_UP

TWO = Decimal('0.01')
ZERO = Decimal('0.00')
GST_SLABS = [Decimal(x) for x in ('0', '0.25', '3', '5', '12', '18', '28', '40')]

def q2(x):
    return Decimal(x).quantize(TWO, rounding=ROUND_HALF_UP)

def norm_state(s):
    return (s or '').strip().lower()

def is_intra_state(place_of_supply, org_state):
    return bool(norm_state(place_of_supply)) and norm_state(place_of_supply) == norm_state(org_state)

def compute(lines, intra, is_tax_inclusive=False, tds_mode='none', tds_tax_rate=Decimal('0.00'), tds_section=''):
    """lines: dicts with Decimal quantity, rate, discount_percent, gst_rate, and optional tds fields.
    Returns (lines_with_amounts, totals). Intra-state => CGST+SGST (half each); otherwise IGST.
    Zero-rated / exempt lines (gst_rate == 0) never receive tax.
    Supports mutually exclusive line-level and transaction-level TDS."""
    out = []
    tot = {'subtotal': ZERO, 'cgst': ZERO, 'sgst': ZERO, 'igst': ZERO}
    tds_mode_val = str(tds_mode or 'none').lower().strip()
    if tds_mode_val not in ('line', 'transaction'):
        tds_mode_val = 'none'
    total_line_tds = ZERO

    for ln in lines:
        gross = ln['quantity'] * ln['rate']
        discount_amount = ln.get('discount_amount', ZERO) or ZERO
        discounted_gross = max(ZERO, gross - discount_amount)
        disc_factor = (Decimal(100) - ln['discount_percent']) / Decimal(100)
        gst_r = ln['gst_rate']
        if is_tax_inclusive and gst_r > 0:
            net_entered = q2(discounted_gross if discount_amount else gross * disc_factor)
            taxable = q2(net_entered / (Decimal(1) + (gst_r / Decimal(100))))
            tax_amount = net_entered - taxable
            if intra:
                cg = q2(tax_amount / 2)
                sg = tax_amount - cg
                ig = ZERO
            else:
                cg = sg = ZERO
                ig = tax_amount
            line_total = net_entered
        else:
            taxable = q2(discounted_gross if discount_amount else gross * disc_factor)
            tax = taxable * gst_r / Decimal(100)
            if intra:
                cg = sg = q2(tax / 2)
                ig = ZERO
            else:
                cg = sg = ZERO
                ig = q2(tax)
            tax_amount = cg + sg + ig
            line_total = taxable + tax_amount

        # Line-Level TDS
        if tds_mode_val == 'line':
            raw_tds_r = ln.get('tds_rate')
            ln_tds_rate = Decimal(str(raw_tds_r or 0)) if raw_tds_r is not None else ZERO
            ln_applicable = bool(ln.get('tds_applicable') or ln_tds_rate > 0)
            if ln_applicable and ln_tds_rate > 0:
                ln_tds_amt = q2(taxable * ln_tds_rate / Decimal('100'))
            else:
                ln_tds_amt = ZERO
                ln_applicable = False
                ln_tds_rate = ZERO
            ln_section = str(ln.get('tds_section') or '')
            total_line_tds += ln_tds_amt
        else:
            ln_applicable = False
            ln_tds_rate = ZERO
            ln_section = ''
            ln_tds_amt = ZERO

        out.append({
            **ln,
            'taxable': taxable,
            'tax_amount': tax_amount,
            'line_total': line_total,
            'tds_applicable': ln_applicable,
            'tds_rate': ln_tds_rate,
            'tds_section': ln_section,
            'tds_amount': ln_tds_amt,
        })
        tot['subtotal'] += taxable
        tot['cgst'] += cg
        tot['sgst'] += sg
        tot['igst'] += ig

    # Totals TDS
    if tds_mode_val == 'line':
        doc_tds_amt = total_line_tds
        doc_tds_rate = ZERO
        doc_tds_sec = ''
    elif tds_mode_val == 'transaction':
        raw_txn_r = tds_tax_rate
        doc_tds_rate = Decimal(str(raw_txn_r or 0)) if raw_txn_r is not None else ZERO
        doc_tds_amt = q2(tot['subtotal'] * doc_tds_rate / Decimal('100')) if doc_tds_rate > 0 else ZERO
        doc_tds_sec = str(tds_section or '')
    else:
        doc_tds_amt = ZERO
        doc_tds_rate = ZERO
        doc_tds_sec = ''

    tot['tds_mode'] = tds_mode_val
    tot['tds_tax_rate'] = doc_tds_rate
    tot['tds_section'] = doc_tds_sec
    tot['tds_amount'] = doc_tds_amt

    gross_total = tot['subtotal'] + tot['cgst'] + tot['sgst'] + tot['igst']
    tot['total'] = max(ZERO, gross_total - doc_tds_amt)
    return out, tot

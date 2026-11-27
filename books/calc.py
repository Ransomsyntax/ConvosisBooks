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

def compute(lines, intra, is_tax_inclusive=False, tds_mode='none', tds_tax_rate=Decimal('0.00'), tds_section='', tcs_rate=Decimal('0.00'), adjustment=Decimal('0.00')):
    """lines: dicts with Decimal quantity, rate, discount_percent, gst_rate, and optional tds fields.
    Returns (lines_with_amounts, totals). Intra-state => CGST+SGST (half each); otherwise IGST.
    Zero-rated / exempt lines (gst_rate == 0) never receive tax.
    Supports mutually exclusive line-level and transaction-level TDS.
    Centralized exact financial calculation engine."""
    out = []
    tot = {'subtotal': ZERO, 'cgst': ZERO, 'sgst': ZERO, 'igst': ZERO}
    tds_mode_val = str(tds_mode or 'none').lower().strip()
    if tds_mode_val not in ('line', 'transaction'):
        tds_mode_val = 'none'
    total_line_tds = ZERO
    eligible_tds_base = ZERO
    total_line_tax = ZERO

    for ln in lines:
        qty = Decimal(str(ln.get('quantity') or 0))
        rate = Decimal(str(ln.get('rate') or 0))
        disc_pct = Decimal(str(ln.get('discount_percent') or 0))
        raw_disc_amt = ln.get('discount_amount')
        disc_amt_entered = Decimal(str(raw_disc_amt or 0)) if raw_disc_amt is not None else ZERO

        gross = qty * rate
        if disc_amt_entered > ZERO:
            discount_amount = q2(min(gross, disc_amt_entered))
        elif disc_pct > ZERO:
            discount_amount = q2(gross * (min(Decimal('100'), disc_pct) / Decimal('100')))
        else:
            discount_amount = ZERO

        discounted_gross = max(ZERO, gross - discount_amount)
        gst_r = Decimal(str(ln.get('gst_rate') or 0))

        if is_tax_inclusive and gst_r > 0:
            net_entered = q2(discounted_gross)
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
            taxable = q2(discounted_gross)
            tax = taxable * gst_r / Decimal(100)
            if intra:
                cg = sg = q2(tax / 2)
                ig = ZERO
            else:
                cg = sg = ZERO
                ig = q2(tax)
            tax_amount = cg + sg + ig
            line_total = taxable + tax_amount

        total_line_tax += tax_amount

        # Check TDS eligibility for this line
        raw_eligible = ln.get('tds_applicable')
        if raw_eligible is None:
            raw_eligible = ln.get('is_tds_eligible')
        if raw_eligible is None:
            # Default to eligible for transaction-level mode, unless explicitly opted out
            is_line_eligible = True
        else:
            is_line_eligible = bool(raw_eligible is not False and raw_eligible != 0)

        # Line-Level TDS
        if tds_mode_val == 'line':
            raw_tds_r = ln.get('tds_rate')
            ln_tds_rate = Decimal(str(raw_tds_r or 0)) if raw_tds_r is not None else ZERO
            if is_line_eligible and ln_tds_rate > ZERO:
                ln_tds_amt = q2(taxable * ln_tds_rate / Decimal('100'))
                ln_applicable = True
                eligible_tds_base += taxable
            else:
                ln_tds_amt = ZERO
                ln_applicable = False
                ln_tds_rate = ZERO
            ln_section = str(ln.get('tds_section') or '')
            total_line_tds += ln_tds_amt
        else:
            ln_applicable = is_line_eligible
            ln_tds_rate = ZERO
            ln_section = ''
            ln_tds_amt = ZERO
            if is_line_eligible:
                eligible_tds_base += taxable

        out.append({
            **ln,
            'quantity': qty,
            'rate': rate,
            'discount_percent': disc_pct,
            'discount_amount': discount_amount,
            'gst_rate': gst_r,
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
        doc_tds_amt = q2(eligible_tds_base * doc_tds_rate / Decimal('100')) if doc_tds_rate > ZERO else ZERO
        doc_tds_sec = str(tds_section or '')
    else:
        doc_tds_amt = ZERO
        doc_tds_rate = ZERO
        doc_tds_sec = ''

    tot['tds_mode'] = tds_mode_val
    tot['tds_tax_rate'] = doc_tds_rate
    tot['tds_section'] = doc_tds_sec
    tot['tds_amount'] = doc_tds_amt
    tot['eligible_tds_base'] = eligible_tds_base

    # TCS calculation
    raw_tcs_r = tcs_rate
    tcs_r = Decimal(str(raw_tcs_r or 0)) if raw_tcs_r is not None else ZERO
    tcs_amt = q2(tot['subtotal'] * tcs_r / Decimal('100')) if tcs_r > ZERO else Decimal(str(ln.get('tcs_amount', ZERO) if lines else ZERO))
    tot['tcs_rate'] = tcs_r
    tot['tcs_amount'] = tcs_amt

    # Adjustment
    adj = q2(Decimal(str(adjustment or 0))) if adjustment is not None else ZERO
    tot['adjustment'] = adj

    # Gross invoice total: Subtotal + Taxes + TCS + Adjustment
    gross_total = tot['subtotal'] + tot['cgst'] + tot['sgst'] + tot['igst'] + tcs_amt + adj
    tot['gross_total'] = gross_total

    # Net settlement amount: Gross Invoice Total - TDS Withheld
    net_settlement = max(ZERO, gross_total - doc_tds_amt)
    tot['net_settlement'] = net_settlement
    tot['net_amount'] = net_settlement
    tot['total'] = net_settlement
    return out, tot

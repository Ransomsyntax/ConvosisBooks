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

def compute(lines, intra, is_tax_inclusive=False):
    """lines: dicts with Decimal quantity, rate, discount_percent, gst_rate.
    Returns (lines_with_amounts, totals). Intra-state => CGST+SGST (half each); otherwise IGST.
    Zero-rated / exempt lines (gst_rate == 0) never receive tax."""
    out = []
    tot = {'subtotal': ZERO, 'cgst': ZERO, 'sgst': ZERO, 'igst': ZERO}
    for ln in lines:
        gross = ln['quantity'] * ln['rate']
        disc_factor = (Decimal(100) - ln['discount_percent']) / Decimal(100)
        gst_r = ln['gst_rate']
        if is_tax_inclusive and gst_r > 0:
            net_entered = q2(gross * disc_factor)
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
            taxable = q2(gross * disc_factor)
            tax = taxable * gst_r / Decimal(100)
            if intra:
                cg = sg = q2(tax / 2)
                ig = ZERO
            else:
                cg = sg = ZERO
                ig = q2(tax)
            tax_amount = cg + sg + ig
            line_total = taxable + tax_amount

        out.append({**ln, 'taxable': taxable, 'tax_amount': tax_amount, 'line_total': line_total})
        tot['subtotal'] += taxable
        tot['cgst'] += cg
        tot['sgst'] += sg
        tot['igst'] += ig
    tot['total'] = tot['subtotal'] + tot['cgst'] + tot['sgst'] + tot['igst']
    return out, tot

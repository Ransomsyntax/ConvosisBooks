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


def compute(lines, intra):
    """lines: dicts with Decimal quantity, rate, discount_percent, gst_rate.
    Returns (lines_with_amounts, totals). Intra-state => CGST+SGST (half each); otherwise IGST.
    Zero-rated / exempt lines (gst_rate == 0) never receive tax."""
    out = []
    tot = {'subtotal': ZERO, 'cgst': ZERO, 'sgst': ZERO, 'igst': ZERO}
    for ln in lines:
        gross = ln['quantity'] * ln['rate']
        taxable = q2(gross * (Decimal(100) - ln['discount_percent']) / Decimal(100))
        tax = taxable * ln['gst_rate'] / Decimal(100)
        if intra:
            cg = sg = q2(tax / 2)
            ig = ZERO
        else:
            cg = sg = ZERO
            ig = q2(tax)
        tax_amount = cg + sg + ig
        out.append({**ln, 'taxable': taxable, 'tax_amount': tax_amount, 'line_total': taxable + tax_amount})
        tot['subtotal'] += taxable
        tot['cgst'] += cg
        tot['sgst'] += sg
        tot['igst'] += ig
    tot['total'] = tot['subtotal'] + tot['cgst'] + tot['sgst'] + tot['igst']
    return out, tot

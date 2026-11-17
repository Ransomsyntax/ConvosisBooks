"""
Organisation Module Gating Framework.
Single source of truth for organization module activation, dependencies, and permission checks.
"""

from typing import Dict, Any, Tuple, Optional

DEFAULT_MODULE_SETTINGS: Dict[str, bool] = {
    'enableQuotes': True,
    'enableSalesOrders': True,
    'enableDeliveryChallans': True,
    'enableRetainerInvoices': True,
    'enableProjectsTimesheets': True,
    'enableBillsOfEntry': False,
    'enablePaymentRetention': False,
}

MODULE_KEY_MAP: Dict[str, str] = {
    'quotes': 'enableQuotes',
    'sales-orders': 'enableSalesOrders',
    'sales_orders': 'enableSalesOrders',
    'delivery-challans': 'enableDeliveryChallans',
    'delivery_challans': 'enableDeliveryChallans',
    'retainer-invoices': 'enableRetainerInvoices',
    'retainer_invoices': 'enableRetainerInvoices',
    'projects': 'enableProjectsTimesheets',
    'timesheets': 'enableProjectsTimesheets',
    'bills-of-entry': 'enableBillsOfEntry',
    'bills_of_entry': 'enableBillsOfEntry',
    'payment-retention': 'enablePaymentRetention',
    'payment_retention': 'enablePaymentRetention',
}

MODULE_DISPLAY_NAMES: Dict[str, str] = {
    'quotes': 'Quotes',
    'sales-orders': 'Sales Orders',
    'sales_orders': 'Sales Orders',
    'delivery-challans': 'Delivery Challans',
    'delivery_challans': 'Delivery Challans',
    'retainer-invoices': 'Retainer Invoices',
    'retainer_invoices': 'Retainer Invoices',
    'projects': 'Projects & Time Tracking',
    'timesheets': 'Timesheets',
    'bills-of-entry': 'Bill of Entry',
    'bills_of_entry': 'Bill of Entry',
    'payment-retention': 'Contractual Retention',
    'payment_retention': 'Contractual Retention',
}


def get_organization_module_preferences(org) -> Dict[str, bool]:
    """
    Returns the raw enterprise preferences dictionary for generalModules for this organisation.
    """
    if not org:
        return dict(DEFAULT_MODULE_SETTINGS)
    gs = getattr(org, 'general_settings', None) or {}
    ep = gs.get('enterprise_preferences', {})
    gm = ep.get('generalModules', {})
    prefs = dict(DEFAULT_MODULE_SETTINGS)
    if isinstance(gm, dict):
        for k in DEFAULT_MODULE_SETTINGS:
            if k in gm:
                prefs[k] = bool(gm[k])
    return prefs


def get_organization_enabled_modules(org) -> Dict[str, bool]:
    """
    Returns normalized dictionary of module slug -> boolean enabled status.
    Exposed through API endpoints and used for frontend navigation and direct URL routing.
    """
    prefs = get_organization_module_preferences(org)
    return {
        'quotes': bool(prefs.get('enableQuotes', True)),
        'sales_orders': bool(prefs.get('enableSalesOrders', True)),
        'delivery_challans': bool(prefs.get('enableDeliveryChallans', True)),
        'retainer_invoices': bool(prefs.get('enableRetainerInvoices', True)),
        'projects': bool(prefs.get('enableProjectsTimesheets', True)),
        'timesheets': bool(prefs.get('enableProjectsTimesheets', True)),
        'bills_of_entry': bool(prefs.get('enableBillsOfEntry', False)),
        'payment_retention': bool(prefs.get('enablePaymentRetention', False)),
    }


def is_module_enabled(org, module_key: str) -> bool:
    """
    Checks if a specific module is active for the given organisation.
    """
    if not org:
        return True
    flag_name = MODULE_KEY_MAP.get(str(module_key).lower())
    if not flag_name:
        # Unknown or ungated modules (like Invoices, Customers, Vendors) default to enabled
        return True
    prefs = get_organization_module_preferences(org)
    return bool(prefs.get(flag_name, False))


def validate_module_dependencies(org, proposed_prefs: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """
    Validates module dependencies before applying proposed updates.
    Returns (is_valid: bool, error_message: Optional[str]).
    """
    if not isinstance(proposed_prefs, dict):
        return False, "Invalid preferences payload format."

    enable_so = bool(proposed_prefs.get('enableSalesOrders', True))
    enable_dc = bool(proposed_prefs.get('enableDeliveryChallans', True))

    # Dependency Rule 1: Delivery Challans requires Sales Orders to be enabled
    if enable_dc and not enable_so:
        return False, (
            "Delivery Challans depends on Sales Orders. You cannot disable Sales Orders "
            "while Delivery Challans is active."
        )

    return True, None

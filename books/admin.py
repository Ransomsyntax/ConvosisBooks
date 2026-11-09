from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DefaultUserAdmin
from django.contrib.auth.models import User, Group

from . import models

# ==============================================================================
# USER MANAGEMENT & TENANT ROLE INLINE
# ==============================================================================

class UserProfileInline(admin.StackedInline):
    model = models.UserProfile
    can_delete = False
    verbose_name_plural = 'Tenant Profile & Role'
    fk_name = 'user'
    fields = ('user_id_code', 'organization', 'role', 'phone', 'is_locked', 'mfa_enabled')
    readonly_fields = ('user_id_code',)
    extra = 0

class CustomUserAdmin(DefaultUserAdmin):
    inlines = (UserProfileInline,)
    list_display = ('get_user_id', 'username', 'email', 'get_organization_name', 'get_organization_id', 'get_role', 'is_active', 'is_staff', 'is_superuser')
    list_filter = ('is_active', 'is_staff', 'is_superuser', 'profile__role', 'profile__organization')
    search_fields = ('username', 'email', 'first_name', 'last_name', 'profile__user_id_code', 'profile__organization__organization_id', 'profile__organization__name')
    actions = ('activate_users', 'deactivate_users')

    def get_inline_instances(self, request, obj=None):
        if not obj:
            return []
        return super().get_inline_instances(request, obj)

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        if not hasattr(obj, 'profile'):
            admin_profile = getattr(request.user, 'profile', None)
            org = (admin_profile.organization if admin_profile else None) or models.Organization.objects.first()
            role = models.UserProfile.ADMIN if (obj.is_superuser or obj.is_staff) else models.UserProfile.ACCOUNTANT
            models.UserProfile.objects.get_or_create(
                user=obj,
                defaults={'organization': org, 'role': role}
            )

    @admin.display(description='User ID')
    def get_user_id(self, obj):
        profile = getattr(obj, 'profile', None)
        return profile.user_id_code if (profile and profile.user_id_code) else f"USR-{obj.pk:08d}"

    @admin.display(description='Role')
    def get_role(self, obj):
        profile = getattr(obj, 'profile', None)
        return profile.get_role_display() if profile else '—'

    @admin.display(description='Organization Name')
    def get_organization_name(self, obj):
        profile = getattr(obj, 'profile', None)
        return profile.organization.name if (profile and profile.organization) else '—'

    @admin.display(description='Organization ID')
    def get_organization_id(self, obj):
        profile = getattr(obj, 'profile', None)
        return profile.organization.organization_id if (profile and profile.organization) else '—'

    @admin.action(description='Activate selected user accounts')
    def activate_users(self, request, queryset):
        count = queryset.update(is_active=True)
        self.message_user(request, f"Activated {count} user account(s).")

    @admin.action(description='Deactivate selected user accounts')
    def deactivate_users(self, request, queryset):
        count = queryset.filter(is_superuser=False).update(is_active=False)
        self.message_user(request, f"Deactivated {count} non-superuser account(s).")

try:
    admin.site.unregister(User)
except admin.sites.NotRegistered:
    pass
admin.site.register(User, CustomUserAdmin)


# ==============================================================================
# ORGANIZATIONS & SUB-ORGANIZATIONS
# ==============================================================================

@admin.register(models.Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ('organization_id', 'name', 'code', 'org_type', 'parent', 'company_id', 'gstin', 'phone', 'email', 'website', 'get_users_count', 'get_subscription_plan', 'status', 'is_active')
    list_filter = ('org_type', 'status', 'is_active', 'state')
    search_fields = ('organization_id', 'name', 'code', 'company_id', 'gstin', 'email', 'phone')
    ordering = ('id',)
    readonly_fields = ('organization_id',)

    @admin.display(description='Users Count')
    def get_users_count(self, obj):
        return obj.members.count()

    @admin.display(description='Purchased Plan')
    def get_subscription_plan(self, obj):
        sub = getattr(obj, 'subscription', None)
        if sub and getattr(sub, 'plan', None):
            return sub.plan.name
        return 'Free Plan'


@admin.register(models.UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user_id_code', 'user', 'organization', 'role', 'phone', 'is_locked', 'mfa_enabled', 'created_at')
    list_filter = ('role', 'is_locked', 'mfa_enabled', 'organization')
    search_fields = ('user_id_code', 'user__username', 'user__email', 'organization__organization_id', 'organization__name', 'phone')
    readonly_fields = ('user_id_code',)


@admin.register(models.Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization', 'name', 'is_system', 'created_at')
    list_filter = ('is_system', 'organization')
    search_fields = ('name',)


@admin.register(models.UserInvitation)
class UserInvitationAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization', 'name', 'email', 'role_name', 'is_accountant', 'status', 'expires_at')
    list_filter = ('status', 'is_accountant', 'organization')
    search_fields = ('name', 'email')


# ==============================================================================
# CUSTOMER & VENDOR MANAGEMENT
# ==============================================================================

@admin.register(models.Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization', 'name', 'company', 'email', 'phone', 'state', 'gstin', 'active')
    list_filter = ('active', 'state', 'organization')
    search_fields = ('name', 'company', 'email', 'phone', 'gstin')


@admin.register(models.Vendor)
class VendorAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization', 'name', 'company', 'email', 'phone', 'state', 'gstin', 'active')
    list_filter = ('active', 'state', 'organization')
    search_fields = ('name', 'company', 'email', 'phone', 'gstin')


@admin.register(models.CustomerPortalAccess)
class CustomerPortalAccessAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization', 'customer', 'portal_username', 'is_active', 'last_login_at')
    list_filter = ('is_active', 'organization')
    search_fields = ('customer__name', 'portal_username')


@admin.register(models.VendorPortalAccess)
class VendorPortalAccessAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization', 'vendor', 'is_active', 'last_login_at')
    list_filter = ('is_active', 'organization')
    search_fields = ('vendor__name',)


# ==============================================================================
# PRODUCTS, WAREHOUSES & INVENTORY
# ==============================================================================

@admin.register(models.Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization', 'name', 'sku', 'item_type', 'selling_price', 'purchase_price', 'hsn_sac', 'active')
    list_filter = ('item_type', 'active', 'organization')
    search_fields = ('name', 'sku', 'hsn_sac')


@admin.register(models.Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization', 'name', 'code', 'city', 'state', 'is_primary', 'active')
    list_filter = ('is_primary', 'active', 'organization')
    search_fields = ('name', 'code', 'city', 'state')


@admin.register(models.PriceList)
class PriceListAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization', 'name', 'pricing_scheme', 'percentage', 'active')
    list_filter = ('pricing_scheme', 'active', 'organization')
    search_fields = ('name',)


@admin.register(models.StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization', 'item', 'kind', 'warehouse', 'change', 'balance_after', 'date', 'created_at')
    list_filter = ('kind', 'date', 'organization')
    search_fields = ('item__name', 'reason', 'notes')


class StockTransferLineInline(admin.TabularInline):
    model = models.StockTransferLine
    extra = 1

@admin.register(models.StockTransfer)
class StockTransferAdmin(admin.ModelAdmin):
    inlines = (StockTransferLineInline,)
    list_display = ('id', 'organization', 'number', 'source_warehouse', 'destination_warehouse', 'status', 'date')
    list_filter = ('status', 'date', 'organization')
    search_fields = ('number', 'notes')


# ==============================================================================
# INVOICE, BILL & ORDER RECORDS WITH LINE INLINES
# ==============================================================================

class InvoiceLineInline(admin.TabularInline):
    model = models.InvoiceLine
    extra = 1

@admin.register(models.Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    inlines = (InvoiceLineInline,)
    list_display = ('id', 'organization', 'number', 'customer', 'date', 'due_date', 'subtotal', 'total', 'status')
    list_filter = ('status', 'date', 'organization')
    search_fields = ('number', 'customer__name', 'order_number')
    date_hierarchy = 'date'


class BillLineInline(admin.TabularInline):
    model = models.BillLine
    extra = 1

@admin.register(models.Bill)
class BillAdmin(admin.ModelAdmin):
    inlines = (BillLineInline,)
    list_display = ('id', 'organization', 'number', 'vendor', 'date', 'due_date', 'subtotal', 'total', 'status')
    list_filter = ('status', 'date', 'organization')
    search_fields = ('number', 'vendor__name')
    date_hierarchy = 'date'


class QuoteLineInline(admin.TabularInline):
    model = models.QuoteLine
    extra = 1

@admin.register(models.Quote)
class QuoteAdmin(admin.ModelAdmin):
    inlines = (QuoteLineInline,)
    list_display = ('id', 'organization', 'number', 'customer', 'date', 'expiry_date', 'total', 'status')
    list_filter = ('status', 'date', 'organization')
    search_fields = ('number', 'customer__name')
    date_hierarchy = 'date'


class SalesOrderLineInline(admin.TabularInline):
    model = models.SalesOrderLine
    extra = 1

@admin.register(models.SalesOrder)
class SalesOrderAdmin(admin.ModelAdmin):
    inlines = (SalesOrderLineInline,)
    list_display = ('id', 'organization', 'number', 'customer', 'date', 'total', 'status')
    list_filter = ('status', 'date', 'organization')
    search_fields = ('number', 'customer__name')


class PurchaseOrderLineInline(admin.TabularInline):
    model = models.PurchaseOrderLine
    extra = 1

@admin.register(models.PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    inlines = (PurchaseOrderLineInline,)
    list_display = ('id', 'organization', 'number', 'vendor', 'date', 'total', 'status')
    list_filter = ('status', 'date', 'organization')
    search_fields = ('number', 'vendor__name')


class CreditNoteLineInline(admin.TabularInline):
    model = models.CreditNoteLine
    extra = 1

@admin.register(models.CreditNote)
class CreditNoteAdmin(admin.ModelAdmin):
    inlines = (CreditNoteLineInline,)
    list_display = ('id', 'organization', 'number', 'customer', 'date', 'total', 'status')
    list_filter = ('status', 'date', 'organization')
    search_fields = ('number', 'customer__name')


class VendorCreditLineInline(admin.TabularInline):
    model = models.VendorCreditLine
    extra = 1

@admin.register(models.VendorCredit)
class VendorCreditAdmin(admin.ModelAdmin):
    inlines = (VendorCreditLineInline,)
    list_display = ('id', 'organization', 'number', 'vendor', 'date', 'total', 'status')
    list_filter = ('status', 'date', 'organization')
    search_fields = ('number', 'vendor__name')


class RetainerInvoiceLineInline(admin.TabularInline):
    model = models.RetainerInvoiceLine
    extra = 1

@admin.register(models.RetainerInvoice)
class RetainerInvoiceAdmin(admin.ModelAdmin):
    inlines = (RetainerInvoiceLineInline,)
    list_display = ('id', 'organization', 'number', 'customer', 'date', 'due_date', 'total', 'status')
    list_filter = ('status', 'date', 'organization')
    search_fields = ('number', 'customer__name')


@admin.register(models.RetainerPayment)
class RetainerPaymentAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization', 'retainer', 'date', 'amount', 'mode', 'reference')
    list_filter = ('mode', 'date', 'organization')
    search_fields = ('retainer__number', 'reference')


@admin.register(models.RetainerInvoiceAllocation)
class RetainerInvoiceAllocationAdmin(admin.ModelAdmin):
    list_display = ('id', 'retainer', 'invoice', 'date', 'amount')


@admin.register(models.RecurringInvoice)
class RecurringInvoiceAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization', 'profile_name', 'customer', 'frequency', 'next_date', 'status')
    list_filter = ('status', 'frequency', 'organization')
    search_fields = ('profile_name', 'customer__name')


class DeliveryChallanLineInline(admin.TabularInline):
    model = models.DeliveryChallanLine
    extra = 1

@admin.register(models.DeliveryChallan)
class DeliveryChallanAdmin(admin.ModelAdmin):
    inlines = (DeliveryChallanLineInline,)
    list_display = ('id', 'organization', 'number', 'customer', 'date', 'challan_type', 'status')
    list_filter = ('status', 'challan_type', 'organization')
    search_fields = ('number', 'customer__name')


# ==============================================================================
# PAYMENTS & EXPENSES
# ==============================================================================

@admin.register(models.PaymentReceived)
class PaymentReceivedAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization', 'number', 'customer', 'date', 'amount', 'mode', 'reference')
    list_filter = ('mode', 'date', 'organization')
    search_fields = ('number', 'customer__name', 'reference')


@admin.register(models.PaymentMade)
class PaymentMadeAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization', 'number', 'vendor', 'date', 'amount', 'mode', 'reference')
    list_filter = ('mode', 'date', 'organization')
    search_fields = ('number', 'vendor__name', 'reference')


@admin.register(models.Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization', 'number', 'date', 'expense_account', 'vendor', 'amount', 'total')
    list_filter = ('date', 'organization')
    search_fields = ('number', 'notes', 'reference')


# ==============================================================================
# BANKING & CASH
# ==============================================================================

@admin.register(models.BankAccount)
class BankAccountAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization', 'name', 'account_number', 'bank_name', 'account_type', 'currency', 'active')
    list_filter = ('account_type', 'active', 'organization')
    search_fields = ('name', 'account_number', 'bank_name')


@admin.register(models.BankTransaction)
class BankTransactionAdmin(admin.ModelAdmin):
    list_display = ('id', 'bank_account', 'date', 'transaction_type', 'withdrawal', 'deposit', 'balance', 'status')
    list_filter = ('transaction_type', 'status', 'date')
    search_fields = ('description', 'reference')


@admin.register(models.BankDeposit)
class BankDepositAdmin(admin.ModelAdmin):
    list_display = ('id', 'number', 'bank_account', 'date', 'amount', 'status')
    list_filter = ('status', 'date')
    search_fields = ('number', 'reference')


@admin.register(models.BankTransfer)
class BankTransferAdmin(admin.ModelAdmin):
    list_display = ('id', 'number', 'from_account', 'to_account', 'date', 'amount', 'status')
    list_filter = ('status', 'date')
    search_fields = ('number', 'reference')


@admin.register(models.BankRule)
class BankRuleAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'field', 'operator', 'value', 'priority', 'active')
    list_filter = ('field', 'active')
    search_fields = ('name',)


# ==============================================================================
# TAXES, COMPLIANCE & E-WAY / E-INVOICE
# ==============================================================================

@admin.register(models.EInvoiceRecord)
class EInvoiceRecordAdmin(admin.ModelAdmin):
    list_display = ('id', 'invoice', 'irn', 'status', 'ack_no', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('irn', 'ack_no', 'invoice__number')


@admin.register(models.EWayBill)
class EWayBillAdmin(admin.ModelAdmin):
    list_display = ('id', 'bill_number', 'doc_type', 'doc_number', 'vehicle_number', 'status', 'valid_until')
    list_filter = ('status', 'doc_type')
    search_fields = ('bill_number', 'vehicle_number', 'doc_number', 'party_name')


# ==============================================================================
# DPDP ACT (DIGITAL PERSONAL DATA PROTECTION ACT, 2023) COMPLIANCE
# ==============================================================================

@admin.register(models.DPDPConsentRecord)
class DPDPConsentRecordAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization', 'data_principal_name', 'data_principal_email', 'purpose', 'consent_type', 'status', 'granted_at')
    list_filter = ('status', 'purpose', 'consent_type', 'organization')
    search_fields = ('data_principal_name', 'data_principal_email', 'data_principal_phone')
    readonly_fields = ('granted_at', 'ip_address', 'user_agent')


@admin.register(models.DPDPDataSubjectRequest)
class DPDPDataSubjectRequestAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization', 'request_number', 'data_principal_name', 'request_type', 'status', 'statutory_hold', 'created_at')
    list_filter = ('request_type', 'status', 'statutory_hold', 'organization')
    search_fields = ('request_number', 'data_principal_name', 'data_principal_email')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(models.DPDPBreachIncident)
class DPDPBreachIncidentAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization', 'incident_id', 'incident_type', 'severity', 'status', 'cert_in_notified', 'detected_at')
    list_filter = ('severity', 'status', 'incident_type', 'cert_in_notified', 'organization')
    search_fields = ('incident_id', 'description')
    readonly_fields = ('reported_at',)


@admin.register(models.DPDPDataProcessor)
class DPDPDataProcessorAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization', 'vendor_name', 'service_type', 'country', 'dpa_signed', 'is_active')
    list_filter = ('dpa_signed', 'is_active', 'country', 'organization')
    search_fields = ('vendor_name', 'service_type', 'contact_email')


# ==============================================================================
# SUBSCRIPTIONS, AUDIT LOGS & PROJECTS
# ==============================================================================

@admin.register(models.TenantSubscription)
class TenantSubscriptionAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization', 'tier', 'status', 'billing_cycle', 'is_trial', 'record_limit', 'user_seat_limit', 'period_end')
    list_filter = ('tier', 'status', 'billing_cycle', 'is_trial')
    search_fields = ('organization__name',)


@admin.register(models.SubscriptionInvoice)
class SubscriptionInvoiceAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization', 'invoice_no', 'date', 'description', 'amount', 'status')
    list_filter = ('status', 'date')
    search_fields = ('invoice_no', 'description')


@admin.register(models.AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization', 'user', 'action', 'entity_type', 'entity_id', 'summary', 'status', 'timestamp')
    list_filter = ('action', 'entity_type', 'status', 'timestamp', 'organization')
    search_fields = ('summary', 'user__username', 'entity_type')
    readonly_fields = ('timestamp',)


@admin.register(models.Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization', 'name', 'code', 'customer', 'status', 'billing_method')
    list_filter = ('status', 'billing_method', 'organization')
    search_fields = ('name', 'code', 'customer__name')

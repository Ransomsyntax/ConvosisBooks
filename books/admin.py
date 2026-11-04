from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DefaultUserAdmin
from django.contrib.auth.models import User

from . import models

class UserProfileInline(admin.StackedInline):
    model = models.UserProfile
    can_delete = False
    verbose_name_plural = 'Tenant Profile & Role'
    fk_name = 'user'
    fields = ('organization', 'role', 'phone', 'is_locked', 'mfa_enabled')

class CustomUserAdmin(DefaultUserAdmin):
    inlines = (UserProfileInline,)
    list_display = ('username', 'email', 'first_name', 'get_role', 'get_organization', 'is_active', 'is_staff')
    list_filter = ('is_active', 'is_staff', 'profile__role', 'profile__organization')

    @admin.display(description='Role')
    def get_role(self, obj):
        profile = getattr(obj, 'profile', None)
        return profile.get_role_display() if profile else '—'

    @admin.display(description='Organization / Tenant')
    def get_organization(self, obj):
        profile = getattr(obj, 'profile', None)
        return profile.organization.name if (profile and profile.organization) else '—'

admin.site.unregister(User)
admin.site.register(User, CustomUserAdmin)

@admin.register(models.UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'organization', 'role', 'phone', 'is_locked', 'mfa_enabled', 'created_at')
    list_filter = ('role', 'is_locked', 'mfa_enabled', 'organization')
    search_fields = ('user__username', 'user__email', 'organization__name', 'phone')

@admin.register(models.Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'company_id', 'gstin', 'state', 'phone', 'email', 'owner')
    search_fields = ('name', 'gstin', 'email', 'company_id')
    list_filter = ('state',)

for m in (
    models.Customer, models.Vendor, models.Item, models.Invoice, models.Bill,
    models.SalesOrder, models.PurchaseOrder, models.CreditNote, models.VendorCredit,
    models.PaymentReceived, models.PaymentMade, models.Expense, models.BankAccount,
    models.Project, models.PriceList, models.Warehouse, models.StockMovement, models.AuditLog
):
    try:
        admin.site.register(m)
    except admin.sites.AlreadyRegistered:
        pass

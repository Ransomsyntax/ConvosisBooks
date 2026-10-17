from django.contrib import admin

from . import models

for m in (models.Organization, models.Customer, models.Vendor, models.Item, models.Invoice,
          models.Bill, models.PaymentReceived, models.PaymentMade, models.StockMovement):
    admin.site.register(m)

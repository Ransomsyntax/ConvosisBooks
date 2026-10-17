from django.urls import path

from . import api

urlpatterns = [
    path('health/', api.health_view),
    path('me/', api.me),
    path('organization/', api.organization),
    path('attachments/', api.attachments_view),
    path('attachments/<int:pk>/', api.attachments_view),
    path('dashboard/', api.dashboard_view),
    path('activity/', api.activity_view),
    path('search/', api.search_view),
    path('lookup/<slug:name>/', api.lookup),

    # Reports
    path('reports/<slug:name>/', api.reports_view),

    # Banking & Reconciliation
    path('banking/statement-import/', api.banking_import_view),
    path('banking/match-suggestions/<int:txn_id>/', api.banking_match_suggestions_view),
    path('banking/reconcile/<int:txn_id>/', api.banking_reconcile_view),
    path('banking/transfer/', api.banking_transfer_view),

    # Document Staging, Soft Delete & OCR
    path('documents/<int:pk>/ocr/', api.document_ocr_view),
    path('documents/<int:pk>/convert/', api.document_convert_view),
    path('documents/<int:pk>/restore/', api.document_restore_view),
    path('documents/<int:pk>/purge/', api.document_purge_view),

    # Tax & Compliance
    path('einvoice/<int:inv_id>/generate/', api.einvoice_generate_view),
    path('eway-bill/<slug:doc_type>/<int:doc_id>/generate/', api.ewaybill_generate_view),
    path('locking/', api.transaction_locking_view),

    # Zia & FinGPT AI Doubt Clearance & Model Context Protocol (MCP)
    path('ai/doubt-clearance/', api.ai_doubt_clearance_view),
    path('ai/query/', api.ai_query_view),
    path('ai/anomalies/', api.ai_anomalies_view),
    path('ai/anomalies/<int:pk>/resolve/', api.ai_anomalies_resolve_view),
    path('mcp/', api.mcp_view),

    # Enterprise Security, MFA & GDPR Compliance
    path('security/compliance-summary/', api.security_compliance_summary_view),
    path('security/mfa-toggle/', api.security_mfa_toggle_view),
    path('security/gdpr-export/', api.security_gdpr_export_view),

    # Standard Resource CRUD
    path('<slug:name>/', api.collection),
    path('<slug:name>/<int:pk>/', api.item),
    path('<slug:name>/<int:pk>/<slug:act>/', api.action),
]

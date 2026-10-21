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

    path('reports/<slug:name>/', api.reports_view),

    path('banking/statement-import/', api.banking_import_view),
    path('banking/feed-sync/<int:bank_account_id>/', api.banking_feed_sync_view),
    path('banking/rules/', api.banking_rules_view),
    path('banking/rules/<int:pk>/', api.banking_rules_detail_view),
    path('banking/rollback/<int:batch_id>/', api.banking_rollback_view),
    path('banking/match-suggestions/<int:txn_id>/', api.banking_match_suggestions_view),
    path('banking/reconcile/<int:txn_id>/', api.banking_reconcile_view),
    path('banking/transfer/', api.banking_transfer_view),

    path('documents/<int:pk>/ocr/', api.document_ocr_view),
    path('documents/<int:pk>/convert/', api.document_convert_view),
    path('documents/<int:pk>/restore/', api.document_restore_view),
    path('documents/<int:pk>/purge/', api.document_purge_view),
    path('einvoice/<int:inv_id>/generate/', api.einvoice_generate_view),
    path('einvoice/authenticated/<int:inv_id>/', api.einvoice_authenticated_view),
    path('eway-bill/<slug:doc_type>/<int:doc_id>/generate/', api.ewaybill_generate_view),
    path('gst/returns/gstr1/', api.gst_returns_gstr1_view),
    path('gst/returns/gstr3b/', api.gst_returns_gstr3b_view),
    path('gst/returns/<int:pk>/file/', api.gst_returns_file_view),
    path('gst/returns/history/', api.gst_returns_history_view),
    path('locking/', api.transaction_locking_view),

    path('ai/doubt-clearance/', api.ai_doubt_clearance_view),
    path('ai/query/', api.ai_query_view),
    path('ai/anomalies/', api.ai_anomalies_view),
    path('ai/anomalies/<int:pk>/resolve/', api.ai_anomalies_resolve_view),
    path('mcp/', api.mcp_view),

    path('security/compliance-summary/', api.security_compliance_summary_view),
    path('security/audit-chain/verify/', api.security_verify_audit_chain_view),
    path('security/mfa-toggle/', api.security_mfa_toggle_view),
    path('security/mfa/setup/', api.security_mfa_setup_view),
    path('security/mfa/verify/', api.security_mfa_verify_view),
    path('security/backup/create/', api.security_backup_create_view),
    path('security/backup/list/', api.security_backup_list_view),
    path('security/backup/disaster-recovery-drill/', api.security_disaster_recovery_drill_view),
    path('security/gdpr-export/', api.security_gdpr_export_view),

    path('jobs/create/', api.jobs_create_view),
    path('jobs/<slug:task_id>/status/', api.jobs_status_view),

    path('portal/customer/<slug:token_or_id>/', api.portal_customer_view),
    path('portal/vendor/<slug:token_or_id>/', api.portal_vendor_view),
    path('interop/zoho/export/<slug:entity>/', api.interop_zoho_export_view),
    path('interop/zoho/import/<slug:entity>/', api.interop_zoho_import_view),

    path('<slug:name>/', api.collection),
    path('<slug:name>/<int:pk>/', api.item),
    path('<slug:name>/<int:pk>/<slug:act>/', api.action),
]
